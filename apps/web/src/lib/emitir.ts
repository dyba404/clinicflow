import { and, eq, sql } from "drizzle-orm";
import { mkdir, writeFile } from "fs/promises";
import { join } from "node:path";
import { getDb, payments, patients, receipts, vatSettings } from "@clinicflow/db";
import { descifrar } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";
import { attachmentsRoot } from "@/lib/attachments";
import {
  lycetConfigurado,
  lycetEmitirComprobante,
  lycetEstadoComprobante,
  lycetExtraerAceptacion,
  lycetGuardarEmpresa,
  lycetMensajeError,
} from "@/lib/lycet";

export type EmitirResultado =
  | {
      ok: true;
      hash: string | null;
      xmlUrl: string | null;
      cdrUrl: string | null;
      cdrPendiente: boolean;
    }
  | { ok: false; error: string; message?: string; status: number };

const TIPO_DOC: Record<string, string> = {
  boleta: "03",
  factura: "01",
  nota_credito: "07",
  nota_debito: "08",
};

const UNIDADES = [
  "",
  "UNO",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
  "DIEZ",
  "ONCE",
  "DOCE",
  "TRECE",
  "CATORCE",
  "QUINCE",
  "DIECISÉIS",
  "DIECISIETE",
  "DIECIOCHO",
  "DIECINUEVE",
  "VEINTE",
];

const VEINTAS = [
  "",
  "VEINTIUNO",
  "VEINTIDÓS",
  "VEINTITRÉS",
  "VEINTICUATRO",
  "VEINTICINCO",
  "VEINTISÉIS",
  "VEINTISIETE",
  "VEINTIOCHO",
  "VEINTINUEVE",
];

const DECENAS = [
  "",
  "",
  "",
  "TREINTA",
  "CUARENTA",
  "CINCUENTA",
  "SESENTA",
  "SETENTA",
  "OCHENTA",
  "NOVENTA",
];

const CENTENAS = [
  "",
  "CIENTO",
  "DOSCIENTOS",
  "TRESCIENTOS",
  "CUATROCIENTOS",
  "QUINIENTOS",
  "SEISCIENTOS",
  "SETECIENTOS",
  "OCHOCIENTOS",
  "NOVECIENTOS",
];

export function enteroEnLetras(n: number): string {
  if (n === 0) return "CERO";
  if (n < 21) return UNIDADES[n] ?? String(n);
  if (n < 30) return VEINTAS[n % 10] ?? String(n);
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? (DECENAS[d] ?? String(n)) : `${DECENAS[d]} Y ${UNIDADES[u]}`;
  }
  if (n === 100) return "CIEN";
  if (n < 1000) {
    const r = n % 100;
    return r === 0
      ? (CENTENAS[Math.floor(n / 100)] ?? String(n))
      : `${CENTENAS[Math.floor(n / 100)]} ${enteroEnLetras(r)}`;
  }
  if (n < 1_000_000) {
    const miles = Math.floor(n / 1000);
    const r = n % 1000;
    const prefijo = miles === 1 ? "MIL" : `${enteroEnLetras(miles)} MIL`;
    return r === 0 ? prefijo : `${prefijo} ${enteroEnLetras(r)}`;
  }
  const millones = Math.floor(n / 1_000_000);
  const r = n % 1_000_000;
  const prefijo = millones === 1 ? "UN MILLÓN" : `${enteroEnLetras(millones)} MILLONES`;
  return r === 0 ? prefijo : `${prefijo} ${enteroEnLetras(r)}`;
}

export function montoEnLetras(monto: number): string {
  const centimos = Math.round(Math.abs(monto) * 100);
  const enteros = Math.floor(centimos / 100);
  const cents = centimos % 100;
  return `${enteroEnLetras(enteros)} CON ${String(cents).padStart(2, "0")}/100`;
}

export function fechaEmisionLima(): string {
  const partes = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const p: Record<string, string> = {};
  for (const q of partes) p[q.type] = q.value;
  const hora = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hora}:${p.minute}:${p.second}-05:00`;
}

export function clienteDesdeDocumento(
  tipo: string,
  pacienteDocumento: string | null,
  pacienteNombre: string | null,
): { tipoDoc: string; numero: string; nombre: string; requiereRuc: boolean } {
  const doc = (pacienteDocumento ?? "").replace(/\s+/g, "");
  let clienteTipoDoc = "1";
  let clienteNumero = "00000000";
  let clienteNombre = "CLIENTES VARIOS";
  let requiereRuc = false;
  if (tipo === "factura") {
    if (!/^\d{11}$/.test(doc)) {
      requiereRuc = true;
    } else {
      clienteTipoDoc = "6";
      clienteNumero = doc;
      clienteNombre = pacienteNombre ?? "CLIENTES VARIOS";
    }
  } else if (/^\d{8}$/.test(doc)) {
    clienteTipoDoc = "1";
    clienteNumero = doc;
    clienteNombre = pacienteNombre ?? "CLIENTES VARIOS";
  } else if (/^\d{11}$/.test(doc)) {
    clienteTipoDoc = "6";
    clienteNumero = doc;
    clienteNombre = pacienteNombre ?? "CLIENTES VARIOS";
  }
  return { tipoDoc: clienteTipoDoc, numero: clienteNumero, nombre: clienteNombre, requiereRuc };
}

export function construirCuerpoEmision(opts: {
  tipo: string;
  serie: string;
  correlativo: number;
  monto: number;
  ruc: string;
  razonSocial: string | null;
  cliente: { tipoDoc: string; numero: string; nombre: string };
  afectado?: { serie: string; correlativo: number; tipo: string; motivo: string | null } | null;
}): Record<string, unknown> {
  const { tipo, serie, correlativo, monto, ruc, razonSocial, cliente, afectado } = opts;
  const valor = Math.round((monto / 1.18) * 100) / 100;
  const igv = Math.round((monto - valor) * 100) / 100;
  const correlativoFmt = String(correlativo).padStart(8, "0");
  const esNota = tipo === "nota_credito" || tipo === "nota_debito";

  const company: Record<string, unknown> = {
    ruc,
    razonSocial: razonSocial ?? ruc,
    address: {
      ubigueo: "150101",
      codigoPais: "PE",
      departamento: "LIMA",
      provincia: "LIMA",
      distrito: "LIMA",
      urbanizacion: "-",
      direccion: razonSocial ?? "SIN DIRECCION",
    },
  };
  if (razonSocial) company.nombreComercial = razonSocial;

  const cuerpo: Record<string, unknown> = {
    ublVersion: "2.1",
    tipoDoc: TIPO_DOC[tipo] ?? "03",
    serie,
    correlativo: String(correlativo),
    fechaEmision: fechaEmisionLima(),
    formaPago: { tipo: "Contado" },
    company,
    client: {
      tipoDoc: cliente.tipoDoc,
      numDoc: cliente.numero,
      rznSocial: cliente.nombre,
    },
    tipoMoneda: "PEN",
    mtoOperGravadas: valor,
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
        descripcion: esNota && afectado
          ? `Anulación de ${afectado.serie}-${String(afectado.correlativo).padStart(8, "0")}`
          : `Servicio clínico - ${serie}-${correlativoFmt}`,
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
    legends: [{ code: "1000", value: `SON ${montoEnLetras(monto)} SOLES` }],
  };
  if (!esNota) cuerpo.tipoOperacion = "0101";
  if (esNota && afectado) {
    cuerpo.codMotivo = "01";
    cuerpo.desMotivo = afectado.motivo ?? "Anulación";
    cuerpo.tipDocAfectado = afectado.tipo === "factura" ? "01" : "03";
    cuerpo.numDocfectado = `${afectado.serie}-${afectado.correlativo}`;
  }
  return cuerpo;
}

export async function emitirComprobante(opts: {
  tenantId: string;
  receiptId: string;
  usuarioId?: string | null;
}): Promise<EmitirResultado> {
  const { tenantId, receiptId } = opts;
  const usuarioId = opts.usuarioId ?? null;
  const db = getDb();

  const [row] = await db
    .select({
      tipo: receipts.tipo,
      serie: receipts.serie,
      correlativo: receipts.correlativo,
      sunatEstado: receipts.sunatEstado,
      afectadoId: receipts.afectadoId,
      emitidaAt: receipts.emitidaAt,
      monto: payments.monto,
      pacienteNombre: patients.nombre,
      pacienteDocumento: patients.documento,
    })
    .from(receipts)
    .innerJoin(payments, eq(receipts.paymentId, payments.id))
    .leftJoin(patients, eq(payments.patientId, patients.id))
    .where(and(eq(receipts.id, receiptId), eq(receipts.tenantId, tenantId)))
    .limit(1);

  if (!row) {
    return { ok: false, error: "comprobante_no_encontrado", status: 404 };
  }
  if (["aceptado", "baja", "baja_pendiente", "baja_aceptada"].includes(row.sunatEstado)) {
    return { ok: false, error: "comprobante_ya_emitido", status: 409 };
  }
  if (row.sunatEstado === "pendiente_envio" && row.emitidaAt) {
    return { ok: false, error: "comprobante_ya_emitido", status: 409 };
  }

  const [config] = await db
    .select()
    .from(vatSettings)
    .where(eq(vatSettings.tenantId, tenantId))
    .limit(1);

  if (config?.emision !== "electronica") {
    return { ok: false, error: "modo_manual", status: 409 };
  }
  if (!lycetConfigurado()) {
    return { ok: false, error: "lycet_no_configurado", status: 503 };
  }
  if (!config.ruc || !config.usuarioSol || !config.claveSolEnc || !config.certificadoEnc) {
    return { ok: false, error: "configuracion_incompleta", status: 409 };
  }

  const cliente = clienteDesdeDocumento(row.tipo, row.pacienteDocumento, row.pacienteNombre);
  if (cliente.requiereRuc) {
    return { ok: false, error: "factura_requiere_ruc", status: 409 };
  }

  let claveSol: string;
  let certificadoPemBase64: string;
  try {
    claveSol = descifrar(config.claveSolEnc);
    certificadoPemBase64 = descifrar(config.certificadoEnc);
  } catch {
    return {
      ok: false,
      error: "configuracion_incompleta",
      message: "credenciales_ilegibles",
      status: 409,
    };
  }

  const monto = Math.round(Number(row.monto) * 100) / 100;
  const esNota = row.tipo === "nota_credito" || row.tipo === "nota_debito";
  const endpoint: "invoice" | "note" = esNota ? "note" : "invoice";

  let afectado: { serie: string; correlativo: number; tipo: string; motivo: string | null } | null =
    null;
  if (esNota) {
    if (!row.afectadoId) {
      return { ok: false, error: "nota_requiere_comprobante_afectado", status: 409 };
    }
    const [afectadoRow] = await db
      .select({
        serie: receipts.serie,
        correlativo: receipts.correlativo,
        tipo: receipts.tipo,
        motivo: receipts.bajaMotivo,
      })
      .from(receipts)
      .where(and(eq(receipts.id, row.afectadoId), eq(receipts.tenantId, tenantId)))
      .limit(1);
    if (!afectadoRow) {
      return { ok: false, error: "comprobante_afectado_no_encontrado", status: 409 };
    }
    afectado = afectadoRow;
  }

  const cuerpo = construirCuerpoEmision({
    tipo: row.tipo,
    serie: row.serie,
    correlativo: row.correlativo,
    monto,
    ruc: config.ruc,
    razonSocial: config.razonSocial,
    cliente: { tipoDoc: cliente.tipoDoc, numero: cliente.numero, nombre: cliente.nombre },
    afectado,
  });

  let empresa: Awaited<ReturnType<typeof lycetGuardarEmpresa>>;
  try {
    empresa = await lycetGuardarEmpresa({
      ruc: config.ruc,
      usuarioSol: config.usuarioSol,
      claveSol,
      certificadoPemBase64,
      ambiente: config.ambiente,
    });
  } catch {
    void logAudit({
      tenantId,
      usuarioId,
      accion: "comprobante.emitir",
      entidad: "receipts",
      entidadId: receiptId,
      payload: { resultado: "lycet_inaccesible", serie: row.serie, correlativo: row.correlativo },
    });
    return { ok: false, error: "lycet_inaccesible", status: 502 };
  }
  if (!empresa.ok) {
    return {
      ok: false,
      error: "configuracion_incompleta",
      message: lycetMensajeError(empresa.status, empresa.body),
      status: 409,
    };
  }

  let res: Awaited<ReturnType<typeof lycetEmitirComprobante>>;
  try {
    res = await lycetEmitirComprobante(endpoint, cuerpo);
  } catch {
    void logAudit({
      tenantId,
      usuarioId,
      accion: "comprobante.emitir",
      entidad: "receipts",
      entidadId: receiptId,
      payload: { resultado: "lycet_inaccesible", serie: row.serie, correlativo: row.correlativo },
    });
    return { ok: false, error: "lycet_inaccesible", status: 502 };
  }

  const aceptacion = lycetExtraerAceptacion(res.body);
  const codeNum = aceptacion.code === null ? Number.NaN : Number(aceptacion.code);
  const esDiferido = res.ok && aceptacion.code !== null && !aceptacion.aceptado && codeNum === 99;

  if (!res.ok || (!aceptacion.aceptado && !esDiferido)) {
    const motivo = aceptacion.message ?? lycetMensajeError(res.status, res.body);
    await db
      .update(receipts)
      .set({ sunatEstado: "rechazado" })
      .where(and(eq(receipts.id, receiptId), eq(receipts.tenantId, tenantId)));
    void logAudit({
      tenantId,
      usuarioId,
      accion: "comprobante.emitir",
      entidad: "receipts",
      entidadId: receiptId,
      payload: {
        resultado: "rechazado",
        code: aceptacion.code,
        motivo,
        serie: row.serie,
        correlativo: row.correlativo,
      },
    });
    return { ok: false, error: "rechazado_sunat", message: motivo, status: 409 };
  }

  let xmlUrl: string | null = null;
  let cdrUrl: string | null = null;
  try {
    const dir = join(attachmentsRoot(), "fiscal", tenantId);
    await mkdir(dir, { recursive: true });
    if (aceptacion.xml) {
      const nombreXml = `${row.serie}-${row.correlativo}.xml`;
      await writeFile(join(dir, nombreXml), aceptacion.xml, "utf8");
      xmlUrl = `/fiscal/${tenantId}/${nombreXml}`;
    }
    if (aceptacion.cdrZipBase64) {
      const nombreCdr = `${row.serie}-${row.correlativo}-cdr.zip`;
      await writeFile(join(dir, nombreCdr), Buffer.from(aceptacion.cdrZipBase64, "base64"));
      cdrUrl = `/fiscal/${tenantId}/${nombreCdr}`;
    }
  } catch {
    xmlUrl = null;
    cdrUrl = null;
  }

  if (esDiferido) {
    await db
      .update(receipts)
      .set({
        sunatEstado: "pendiente_envio",
        xmlUrl,
        emitidaAt: new Date(),
      })
      .where(and(eq(receipts.id, receiptId), eq(receipts.tenantId, tenantId)));
    if (row.tipo === "boleta" || row.tipo === "factura") {
      await db
        .update(vatSettings)
        .set(
          row.tipo === "boleta"
            ? { corrBoleta: sql`${vatSettings.corrBoleta} + 1` }
            : { corrFactura: sql`${vatSettings.corrFactura} + 1` },
        )
        .where(eq(vatSettings.tenantId, tenantId));
    }
    void logAudit({
      tenantId,
      usuarioId,
      accion: "comprobante.emitir",
      entidad: "receipts",
      entidadId: receiptId,
      payload: {
        resultado: "cdr_pendiente",
        code: aceptacion.code,
        serie: row.serie,
        correlativo: row.correlativo,
      },
    });
    return { ok: true, hash: aceptacion.hash, xmlUrl, cdrUrl: null, cdrPendiente: true };
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
    .where(and(eq(receipts.id, receiptId), eq(receipts.tenantId, tenantId)));

  if (esNota && row.afectadoId) {
    await db
      .update(receipts)
      .set({ sunatEstado: "baja_aceptada", bajaEnviadaAt: new Date() })
      .where(
        and(
          eq(receipts.id, row.afectadoId),
          eq(receipts.tenantId, tenantId),
          eq(receipts.sunatEstado, "aceptado"),
        ),
      );
  }

  if (row.tipo === "boleta" || row.tipo === "factura") {
    await db
      .update(vatSettings)
      .set(
        row.tipo === "boleta"
          ? { corrBoleta: sql`${vatSettings.corrBoleta} + 1` }
          : { corrFactura: sql`${vatSettings.corrFactura} + 1` },
      )
      .where(eq(vatSettings.tenantId, tenantId));
  }

  void logAudit({
    tenantId,
    usuarioId,
    accion: "comprobante.emitir",
    entidad: "receipts",
    entidadId: receiptId,
    payload: {
      resultado: "aceptado",
      hash: aceptacion.hash,
      code: aceptacion.code,
      serie: row.serie,
      correlativo: row.correlativo,
    },
  });

  return { ok: true, hash: aceptacion.hash, xmlUrl, cdrUrl, cdrPendiente: false };
}

export type ConsultaCdrResultado =
  | { ok: true; estado: "aceptado" | "rechazado" | "pendiente"; message?: string }
  | { ok: false; error: string; message?: string; status: number };

export async function consultarCdrComprobante(opts: {
  tenantId: string;
  receiptId: string;
  usuarioId?: string | null;
}): Promise<ConsultaCdrResultado> {
  const { tenantId, receiptId } = opts;
  const usuarioId = opts.usuarioId ?? null;
  const db = getDb();

  const [row] = await db
    .select({
      id: receipts.id,
      tipo: receipts.tipo,
      serie: receipts.serie,
      correlativo: receipts.correlativo,
      sunatEstado: receipts.sunatEstado,
      xmlUrl: receipts.xmlUrl,
    })
    .from(receipts)
    .where(and(eq(receipts.id, receiptId), eq(receipts.tenantId, tenantId)))
    .limit(1);

  if (!row) {
    return { ok: false, error: "comprobante_no_encontrado", status: 404 };
  }
  if (row.sunatEstado !== "pendiente_envio" && row.sunatEstado !== "rechazado") {
    return { ok: false, error: "sin_cdr_pendiente", status: 409 };
  }
  if (!lycetConfigurado()) {
    return { ok: false, error: "lycet_no_configurado", status: 503 };
  }

  const [config] = await db
    .select({ ruc: vatSettings.ruc })
    .from(vatSettings)
    .where(eq(vatSettings.tenantId, tenantId))
    .limit(1);
  if (!config?.ruc) {
    return { ok: false, error: "configuracion_incompleta", status: 409 };
  }

  const tipoDoc = row.tipo === "factura" ? "01" : row.tipo === "boleta" ? "03" : null;
  if (!tipoDoc) {
    return { ok: false, error: "tipo_no_consultable", status: 409 };
  }

  let res: Awaited<ReturnType<typeof lycetEstadoComprobante>>;
  try {
    res = await lycetEstadoComprobante(config.ruc, tipoDoc, row.serie, String(row.correlativo));
  } catch {
    return { ok: false, error: "lycet_inaccesible", status: 502 };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: "consulta_fallida",
      message: lycetMensajeError(res.status, res.body),
      status: 502,
    };
  }

  const success = res.body.success === true;
  const code = typeof res.body.code === "string" ? res.body.code : null;
  const cdr = (res.body.cdrResponse ?? {}) as Record<string, unknown>;
  const cdrCode = typeof cdr.code === "string" ? cdr.code : null;

  const mensajeCdr =
    typeof cdr.description === "string" && cdr.description.length > 0
      ? cdr.description
      : undefined;

  if (success) {
    const codeEfectivo = cdrCode ?? code;
    const codeNum = codeEfectivo === null ? Number.NaN : Number(codeEfectivo);
    const aceptado = codeEfectivo === "0" || (Number.isFinite(codeNum) && codeNum >= 4000);
    if (aceptado) {
      let cdrUrl: string | null = null;
      const cdrZipBase64 = typeof res.body.cdrZip === "string" ? res.body.cdrZip : null;
      try {
        if (cdrZipBase64) {
          const dir = join(attachmentsRoot(), "fiscal", tenantId);
          await mkdir(dir, { recursive: true });
          const nombreCdr = `${row.serie}-${row.correlativo}-cdr.zip`;
          await writeFile(join(dir, nombreCdr), Buffer.from(cdrZipBase64, "base64"));
          cdrUrl = `/fiscal/${tenantId}/${nombreCdr}`;
        }
      } catch {
        cdrUrl = null;
      }
      await db
        .update(receipts)
        .set({ sunatEstado: "aceptado", cdrUrl })
        .where(and(eq(receipts.id, receiptId), eq(receipts.tenantId, tenantId)));
      void logAudit({
        tenantId,
        usuarioId,
        accion: "comprobante.consultar_cdr",
        entidad: "receipts",
        entidadId: receiptId,
        payload: { resultado: "aceptado", code: codeEfectivo, serie: row.serie, correlativo: row.correlativo },
      });
      return { ok: true, estado: "aceptado", message: mensajeCdr };
    }

    await db
      .update(receipts)
      .set({ sunatEstado: "rechazado" })
      .where(
        and(
          eq(receipts.id, receiptId),
          eq(receipts.tenantId, tenantId),
          eq(receipts.sunatEstado, "pendiente_envio"),
        ),
      );
    void logAudit({
      tenantId,
      usuarioId,
      accion: "comprobante.consultar_cdr",
      entidad: "receipts",
      entidadId: receiptId,
      payload: { resultado: "rechazado", code: codeEfectivo, message: mensajeCdr },
    });
    return { ok: true, estado: "rechazado", message: mensajeCdr };
  }

  const messageError =
    res.body.error && typeof res.body.error === "object"
      ? ((res.body.error as Record<string, unknown>).message as string | undefined)
      : undefined;

  const noEncontrado = code === "99" || code === "0127";
  void logAudit({
    tenantId,
    usuarioId,
    accion: "comprobante.consultar_cdr",
    entidad: "receipts",
    entidadId: receiptId,
    payload: { resultado: "pendiente", code, message: messageError, noEncontrado },
  });
  return { ok: true, estado: "pendiente", message: messageError ?? mensajeCdr };
}
