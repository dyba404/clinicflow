import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { mkdir, writeFile } from "fs/promises";
import { join } from "node:path";
import { getDb, payments, patients, receipts, vatSettings } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { descifrar } from "@/lib/crypto";
import { logAuditSesion } from "@/lib/audit";
import { attachmentsRoot } from "@/lib/attachments";
import {
  lycetConfigurado,
  lycetEmitirComprobante,
  lycetEnviarBaja,
  lycetEstadoBaja,
  lycetExtraerAceptacion,
  lycetExtraerBaja,
  lycetGuardarEmpresa,
  lycetMensajeError,
} from "@/lib/lycet";

export const dynamic = "force-dynamic";

const PLAZO_BAJA_VOIDED_DIAS = 7;

function fechaHoraLima(d: Date): { fecha: string; hora: string } {
  const partes = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const p: Record<string, string> = {};
  for (const q of partes) p[q.type] = q.value;
  const hora = p.hour === "24" ? "00" : p.hour;
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${hora}:${p.minute}:${p.second}` };
}

function ahoraLimaConZona(): string {
  const { fecha, hora } = fechaHoraLima(new Date());
  return `${fecha}T${hora}-05:00`;
}

async function prepararEnvio(g: { team: { id: string } }) {
  if (!lycetConfigurado()) {
    return { error: "lycet_no_configurado" as const, status: 503 };
  }
  const db = getDb();
  const [config] = await db
    .select()
    .from(vatSettings)
    .where(eq(vatSettings.tenantId, g.team.id))
    .limit(1);
  if (config?.emision !== "electronica") {
    return { error: "modo_manual" as const, status: 409 };
  }
  if (!config.ruc || !config.usuarioSol || !config.claveSolEnc || !config.certificadoEnc) {
    return { error: "configuracion_incompleta" as const, status: 409 };
  }
  let empresa: Awaited<ReturnType<typeof lycetGuardarEmpresa>>;
  try {
    empresa = await lycetGuardarEmpresa({
      ruc: config.ruc,
      usuarioSol: config.usuarioSol,
      claveSol: descifrar(config.claveSolEnc),
      certificadoPemBase64: descifrar(config.certificadoEnc),
      ambiente: config.ambiente,
    });
  } catch {
    return { error: "lycet_inaccesible" as const, status: 502 };
  }
  if (!empresa.ok) {
    return {
      error: "configuracion_incompleta" as const,
      message: lycetMensajeError(empresa.status, empresa.body),
      status: 409,
    };
  }
  return { config };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("receipts.issue");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "facturacion");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: { motivo?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const motivo = body.motivo?.trim();
  if (!motivo || motivo.length < 3) {
    return NextResponse.json({ error: "motivo_requerido" }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .select({
      tipo: receipts.tipo,
      serie: receipts.serie,
      correlativo: receipts.correlativo,
      sunatEstado: receipts.sunatEstado,
      emitidaAt: receipts.emitidaAt,
      paymentId: receipts.paymentId,
      monto: payments.monto,
      pacienteNombre: patients.nombre,
      pacienteDocumento: patients.documento,
    })
    .from(receipts)
    .innerJoin(payments, eq(receipts.paymentId, payments.id))
    .leftJoin(patients, eq(payments.patientId, patients.id))
    .where(and(eq(receipts.id, id), eq(receipts.tenantId, g.team.id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "comprobante_no_encontrado" }, { status: 404 });
  }
  if (row.sunatEstado !== "aceptado") {
    return NextResponse.json(
      { error: "solo_se_puede_dar_de_baja_un_comprobante_aceptado" },
      { status: 409 },
    );
  }
  if (row.tipo !== "boleta" && row.tipo !== "factura") {
    return NextResponse.json({ error: "tipo_no_sujeto_a_baja" }, { status: 409 });
  }

  const plazoLimite = new Date(Date.now() - PLAZO_BAJA_VOIDED_DIAS * 24 * 3600_000);
  const dentroDePlazo = row.emitidaAt !== null && row.emitidaAt >= plazoLimite;
  const usarVoided = row.tipo === "factura" && dentroDePlazo;

  const prep = await prepararEnvio(g);  if ("error" in prep) {
    return NextResponse.json(
      { error: prep.error, ...("message" in prep ? { message: prep.message } : {}) },
      { status: prep.status },
    );
  }
  const config = prep.config;

  const company: Record<string, unknown> = {
    ruc: config.ruc,
    razonSocial: config.razonSocial ?? config.ruc,
    address: {
      ubigueo: "150101",
      codigoPais: "PE",
      departamento: "LIMA",
      provincia: "LIMA",
      distrito: "LIMA",
      urbanizacion: "-",
      direccion: config.razonSocial ?? "SIN DIRECCION",
    },
  };
  if (config.razonSocial) company.nombreComercial = config.razonSocial;

  const numeroOriginal = `${row.serie}-${row.correlativo}`;

  if (usarVoided) {
    const gen = fechaHoraLima(row.emitidaAt ?? new Date());
    const hoy = fechaHoraLima(new Date());
    const inicioDia = new Date(`${hoy.fecha}T00:00:00-05:00`);
    const [enviadasHoy] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(receipts)
      .where(
        and(
          eq(receipts.tenantId, g.team.id),
          sql`${receipts.bajaTicket} is not null`,
          sql`${receipts.bajaEnviadaAt} >= ${inicioDia.toISOString()}`,
        ),
      );
    const corrVoided = String((enviadasHoy?.n ?? 0) + 1);

    const cuerpo: Record<string, unknown> = {
      correlativo: corrVoided,
      fecGeneracion: `${gen.fecha}T00:00:00-05:00`,
      fecComunicacion: ahoraLimaConZona(),
      company,
      details: [
        {
          tipoDoc: "01",
          serie: row.serie,
          correlativo: String(row.correlativo),
          desMotivoBaja: motivo.slice(0, 250),
        },
      ],
    };

    let resVoided: Awaited<ReturnType<typeof lycetEnviarBaja>>;
    try {
      resVoided = await lycetEnviarBaja(cuerpo);
    } catch {
      void logAuditSesion({
        tenantId: g.team.id,
        accion: "comprobante.baja",
        entidad: "receipts",
        entidadId: id,
        payload: { vía: "voided", resultado: "lycet_inaccesible", serie: row.serie, correlativo: row.correlativo },
      });
      return NextResponse.json({ error: "lycet_inaccesible" }, { status: 502 });
    }

    const resultado = lycetExtraerBaja(resVoided.body);
    if (!resVoided.ok || !resultado.ok || !resultado.ticket) {
      const razon =
        resultado.message ??
        lycetMensajeError(resVoided.status, resVoided.body);
      void logAuditSesion({
        tenantId: g.team.id,
        accion: "comprobante.baja",
        entidad: "receipts",
        entidadId: id,
        payload: { vía: "voided", resultado: "rechazado", motivo: razon },
      });
      return NextResponse.json({ error: "rechazado_sunat", message: razon }, { status: 409 });
    }

    await db
      .update(receipts)
      .set({
        sunatEstado: "baja_pendiente",
        bajaTicket: resultado.ticket,
        bajaEnviadaAt: new Date(),
        bajaMotivo: motivo,
      })
      .where(and(eq(receipts.id, id), eq(receipts.tenantId, g.team.id)));

    void logAuditSesion({
      tenantId: g.team.id,
      accion: "comprobante.baja",
      entidad: "receipts",
      entidadId: id,
      payload: {
        vía: "voided",
        resultado: "enviada",
        ticket: resultado.ticket,
        correlativo: corrVoided,
        afectado: numeroOriginal,
      },
    });

    return NextResponse.json({
      ok: true,
      estado: "baja_pendiente",
      ticket: resultado.ticket,
    });
  }

  const [notaPrevia] = await db
    .select({ id: receipts.id, sunatEstado: receipts.sunatEstado })
    .from(receipts)
    .where(
      and(
        eq(receipts.tenantId, g.team.id),
        eq(receipts.afectadoId, id),
        eq(receipts.tipo, "nota_credito"),
      ),
    )
    .orderBy(desc(receipts.createdAt))
    .limit(1);
  if (notaPrevia && notaPrevia.sunatEstado === "pendiente_envio") {
    return NextResponse.json(
      {
        error: "baja_en_curso",
        message:
          "Ya se creó la nota de crédito de anulación y está pendiente de envío. Emítela antes de solicitar otra baja.",
      },
      { status: 409 },
    );
  }

  const serieNota = `${row.serie.charAt(0)}N${row.serie.slice(-2)}`;
  const [maxCorr] = await db
    .select({ m: sql<number>`COALESCE(MAX(${receipts.correlativo}), 0)` })
    .from(receipts)
    .where(
      and(
        eq(receipts.tenantId, g.team.id),
        eq(receipts.tipo, "nota_credito"),
        eq(receipts.serie, serieNota),
      ),
    );
  const corrNota = (maxCorr?.m ?? 0) + 1;
  const monto = Math.round(Number(row.monto) * 100) / 100;
  const valor = Math.round((monto / 1.18) * 100) / 100;
  const igv = Math.round((monto - valor) * 100) / 100;

  const doc = (row.pacienteDocumento ?? "").replace(/\s+/g, "");
  let clienteTipoDoc = "1";
  let clienteNumero = "00000000";
  let clienteNombre = "CLIENTES VARIOS";
  if (/^\d{11}$/.test(doc)) {
    clienteTipoDoc = "6";
    clienteNumero = doc;
    clienteNombre = row.pacienteNombre ?? "CLIENTES VARIOS";
  } else if (/^\d{8}$/.test(doc)) {
    clienteNombre = row.pacienteNombre ?? "CLIENTES VARIOS";
    clienteNumero = doc;
  }

  const numeroNota = `${serieNota}-${corrNota}`;

  const [nota] = await db
    .insert(receipts)
    .values({
      tenantId: g.team.id,
      paymentId: row.paymentId,
      tipo: "nota_credito",
      serie: serieNota,
      correlativo: corrNota,
      estado: "manual",
      sunatEstado: "pendiente_envio",
      afectadoId: id,
      registradoPor: g.user.id,
    })
    .onConflictDoNothing({
      target: [receipts.tenantId, receipts.tipo, receipts.serie, receipts.correlativo],
    })
    .returning({ id: receipts.id });
  if (!nota) {
    return NextResponse.json({ error: "correlativo_ocupado" }, { status: 409 });
  }

  const cuerpo: Record<string, unknown> = {
    ublVersion: "2.1",
    tipoDoc: "07",
    serie: serieNota,
    correlativo: String(corrNota),
    fechaEmision: ahoraLimaConZona(),
    codMotivo: "01",
    desMotivo: motivo.slice(0, 250),
    tipDocAfectado: row.tipo === "factura" ? "01" : "03",
    numDocfectado: numeroOriginal,
    company,
    client: {
      tipoDoc: clienteTipoDoc,
      numDoc: clienteNumero,
      rznSocial: clienteNombre,
    },
    tipoMoneda: "PEN",
    mtoOperGravadas: valor,
    mtoOperInafectas: 0,
    mtoOperExoneradas: 0,
    mtoIGV: igv,
    totalImpuestos: igv,
    valorVenta: valor,
    subTotal: monto,
    mtoImpVenta: monto,
    details: [
      {
        unidad: "NIU",
        cantidad: 1,
        codProducto: "SER001",
        descripcion: `Anulación de ${numeroOriginal}`,
        mtoValorUnitario: valor,
        mtoValorVenta: valor,
        tipAfeIgv: "10",
        mtoBaseIgv: valor,
        porcentajeIgv: 18,
        igv,
        totalImpuestos: igv,
        mtoPrecioUnitario: monto,
      },
    ],
  };

  let res: Awaited<ReturnType<typeof lycetEmitirComprobante>>;
  try {
    res = await lycetEmitirComprobante("note", cuerpo);
  } catch {
    void logAuditSesion({
      tenantId: g.team.id,
      accion: "comprobante.baja",
      entidad: "receipts",
      entidadId: id,
      payload: { resultado: "lycet_inaccesible", serie: row.serie, correlativo: row.correlativo },
    });
    return NextResponse.json({ error: "lycet_inaccesible" }, { status: 502 });
  }

  const aceptacion = lycetExtraerAceptacion(res.body);
  if (!res.ok || !aceptacion.aceptado) {
    const razon = aceptacion.message ?? lycetMensajeError(res.status, res.body);
    await db
      .update(receipts)
      .set({ sunatEstado: "rechazado" })
      .where(and(eq(receipts.id, nota.id), eq(receipts.tenantId, g.team.id)));
    void logAuditSesion({
      tenantId: g.team.id,
      accion: "comprobante.baja",
      entidad: "receipts",
      entidadId: id,
      payload: { resultado: "rechazado", motivo: razon, nota: numeroNota },
    });
    return NextResponse.json({ error: "rechazado_sunat", message: razon }, { status: 409 });
  }

  let xmlUrl: string | null = null;
  let cdrUrl: string | null = null;
  try {
    const dir = join(attachmentsRoot(), "fiscal", g.team.id);
    await mkdir(dir, { recursive: true });
    if (aceptacion.xml) {
      const nombreXml = `${numeroNota}.xml`;
      await writeFile(join(dir, nombreXml), aceptacion.xml, "utf8");
      xmlUrl = `/fiscal/${g.team.id}/${nombreXml}`;
    }
    if (aceptacion.cdrZipBase64) {
      const nombreCdr = `${numeroNota}-cdr.zip`;
      await writeFile(join(dir, nombreCdr), Buffer.from(aceptacion.cdrZipBase64, "base64"));
      cdrUrl = `/fiscal/${g.team.id}/${nombreCdr}`;
    }
  } catch {
    xmlUrl = null;
    cdrUrl = null;
  }

  await db
    .update(receipts)
    .set({
      sunatEstado: "aceptado",
      sunatHash: aceptacion.hash,
      xmlUrl,
      cdrUrl,
      emitidaAt: new Date(),
    })
    .where(and(eq(receipts.id, nota.id), eq(receipts.tenantId, g.team.id)));
  await db
    .update(receipts)
    .set({
      sunatEstado: "baja_aceptada",
      bajaEnviadaAt: new Date(),
      bajaMotivo: motivo,
    })
    .where(and(eq(receipts.id, id), eq(receipts.tenantId, g.team.id)));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "comprobante.baja",
    entidad: "receipts",
    entidadId: id,
    payload: {
      resultado: "nota_aceptada",
      afectado: numeroOriginal,
      nota: numeroNota,
      hash: aceptacion.hash,
    },
  });

  return NextResponse.json({ ok: true, estado: "baja_aceptada", nota: numeroNota, hash: aceptacion.hash });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("receipts.issue");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "facturacion");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const db = getDb();
  const [row] = await db
    .select({
      sunatEstado: receipts.sunatEstado,
      bajaTicket: receipts.bajaTicket,
      serie: receipts.serie,
      correlativo: receipts.correlativo,
    })
    .from(receipts)
    .where(and(eq(receipts.id, id), eq(receipts.tenantId, g.team.id)))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "comprobante_no_encontrado" }, { status: 404 });
  }
  if (row.sunatEstado !== "baja_pendiente" || !row.bajaTicket) {
    return NextResponse.json({ error: "sin_baja_pendiente" }, { status: 409 });
  }
  if (!lycetConfigurado()) {
    return NextResponse.json({ error: "lycet_no_configurado" }, { status: 503 });
  }
  const [config] = await db
    .select({ ruc: vatSettings.ruc })
    .from(vatSettings)
    .where(eq(vatSettings.tenantId, g.team.id))
    .limit(1);
  if (!config?.ruc) {
    return NextResponse.json({ error: "configuracion_incompleta" }, { status: 409 });
  }

  let res: Awaited<ReturnType<typeof lycetEstadoBaja>>;
  try {
    res = await lycetEstadoBaja(config.ruc, row.bajaTicket);
  } catch {
    return NextResponse.json({ error: "lycet_inaccesible" }, { status: 502 });
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: "consulta_fallida", message: lycetMensajeError(res.status, res.body) },
      { status: 502 },
    );
  }

  const code = typeof res.body.code === "string" ? res.body.code : res.body.code === 0 ? "0" : null;
  const cdr = (res.body.cdrResponse ?? {}) as Record<string, unknown>;
  const cdrCode = typeof cdr.code === "string" ? cdr.code : null;
  const cdrEncontrado = code === "0";
  const cdrCodeNum = cdrCode === null ? Number.NaN : Number(cdrCode);
  const aceptada =
    cdrEncontrado &&
    (cdrCode === null || cdrCode === "0" || (Number.isFinite(cdrCodeNum) && cdrCodeNum >= 4000));

  if (aceptada) {
    const cdrZipBase64 = typeof res.body.cdrZip === "string" ? res.body.cdrZip : null;
    let cdrUrl: string | null = null;
    if (cdrZipBase64) {
      try {
        const dir = join(attachmentsRoot(), "fiscal", g.team.id);
        await mkdir(dir, { recursive: true });
        const nombreCdr = `${row.serie}-${row.correlativo}-baja-cdr.zip`;
        await writeFile(join(dir, nombreCdr), Buffer.from(cdrZipBase64, "base64"));
        cdrUrl = `/fiscal/${g.team.id}/${nombreCdr}`;
      } catch {
        cdrUrl = null;
      }
    }
    const updates: { sunatEstado: "baja_aceptada"; cdrUrl?: string } = {
      sunatEstado: "baja_aceptada",
    };
    if (cdrUrl) updates.cdrUrl = cdrUrl;
    await db
      .update(receipts)
      .set(updates)
      .where(and(eq(receipts.id, id), eq(receipts.tenantId, g.team.id)));
    void logAuditSesion({
      tenantId: g.team.id,
      accion: "comprobante.baja",
      entidad: "receipts",
      entidadId: id,
      payload: { resultado: "aceptada", ticket: row.bajaTicket },
    });
    return NextResponse.json({ ok: true, estado: "baja_aceptada" });
  }

  if (code === "98" || code === "0127") {
    return NextResponse.json({ ok: true, estado: "en_proceso" });
  }

  if (code === "98") {
    return NextResponse.json({ ok: true, estado: "en_proceso" });
  }

  await db
    .update(receipts)
    .set({ sunatEstado: "baja_rechazada" })
    .where(and(eq(receipts.id, id), eq(receipts.tenantId, g.team.id)));
  void logAuditSesion({
    tenantId: g.team.id,
    accion: "comprobante.baja",
    entidad: "receipts",
    entidadId: id,
    payload: { resultado: "rechazada", ticket: row.bajaTicket, code },
  });
  return NextResponse.json({ ok: true, estado: "baja_rechazada" });
}
