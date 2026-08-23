import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join, resolve, sep } from "node:path";
import { and, eq } from "drizzle-orm";
import { getDb, payments, patients, receipts, vatSettings } from "@clinicflow/db";
import { resolvePortalAccess } from "@/lib/portal-access";
import { rateLimit, ipReq } from "@/lib/rate-limit";
import { attachmentsRoot } from "@/lib/attachments";
import {
  generarPdfComprobante,
  generarQrPng,
  leerLogoComprobante,
  qrSunatContenido,
} from "@/lib/comprobante-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string; id: string; archivo: string }> },
) {
  const { token, id, archivo } = await params;

  const limite = rateLimit(`portal:descarga:${token}:${ipReq(req)}`, 10);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  const r = await resolvePortalAccess(token);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 404 });
  const { ctx } = r;
  const db = getDb();

  const [row] = await db
    .select({
      tipo: receipts.tipo,
      serie: receipts.serie,
      correlativo: receipts.correlativo,
      sunatEstado: receipts.sunatEstado,
      sunatHash: receipts.sunatHash,
      emitidaAt: receipts.emitidaAt,
      createdAt: receipts.createdAt,
      xmlUrl: receipts.xmlUrl,
      cdrUrl: receipts.cdrUrl,
      patientId: payments.patientId,
      monto: payments.monto,
      metodo: payments.metodo,
      referencia: payments.referencia,
    })
    .from(receipts)
    .innerJoin(payments, eq(receipts.paymentId, payments.id))
    .where(and(eq(receipts.id, id), eq(receipts.tenantId, ctx.team.id)))
    .limit(1);

  if (!row || row.patientId !== ctx.patient.id) {
    return NextResponse.json({ error: "comprobante_no_encontrado" }, { status: 404 });
  }
  const soloBoletaFactura = row.tipo === "boleta" || row.tipo === "factura";
  if (row.sunatEstado !== "aceptado" || !soloBoletaFactura) {
    return NextResponse.json({ error: "comprobante_no_disponible" }, { status: 404 });
  }

  const numero = `${row.serie}-${String(row.correlativo).padStart(8, "0")}`;

  if (archivo === "xml" || archivo === "cdr") {
    const url = archivo === "xml" ? row.xmlUrl : row.cdrUrl;
    if (!url) return NextResponse.json({ error: "archivo_no_disponible" }, { status: 404 });
    const partes = url.split("/").filter(Boolean);
    const nombre = partes[partes.length - 1];
    const raiz = resolve(attachmentsRoot());
    const objetivo = resolve(join(raiz, "fiscal", ctx.team.id, nombre ?? ""));
    if (!objetivo.startsWith(`${resolve(raiz, "fiscal")}${sep}`)) {
      return NextResponse.json({ error: "archivo_no_disponible" }, { status: 404 });
    }
    try {
      const info = await stat(objetivo);
      if (!info.isFile()) throw new Error("no_es_archivo");
      const contenido = await readFile(objetivo);
      return new NextResponse(new Uint8Array(contenido), {
        headers: {
          "Content-Type": archivo === "xml" ? "text/xml" : "application/zip",
          "Content-Disposition": `attachment; filename="${nombre}"`,
          "Cache-Control": "private, max-age=300",
        },
      });
    } catch {
      return NextResponse.json({ error: "archivo_no_disponible" }, { status: 404 });
    }
  }

  if (archivo !== "pdf") {
    return NextResponse.json({ error: "archivo_no_encontrado" }, { status: 404 });
  }

  const [paciente] = await db
    .select({ nombre: patients.nombre, documento: patients.documento })
    .from(patients)
    .where(and(eq(patients.id, ctx.patient.id), eq(patients.tenantId, ctx.team.id)))
    .limit(1);

  const [config] = await db
    .select({ razonSocial: vatSettings.razonSocial, ruc: vatSettings.ruc })
    .from(vatSettings)
    .where(eq(vatSettings.tenantId, ctx.team.id))
    .limit(1);

  const logoPng = await leerLogoComprobante(ctx.team.id);

  const monto = Math.round(Number(row.monto) * 100) / 100;
  const valor = Math.round((monto / 1.18) * 100) / 100;
  const igv = Math.round((monto - valor) * 100) / 100;

  let qrPng: Uint8Array | null = null;
  let qrContenido: string | null = null;
  if (config?.ruc && row.emitidaAt) {
    const docCliente = (paciente?.documento ?? "").replace(/\s+/g, "");
    const cliente = /^\d{11}$/.test(docCliente)
      ? { tipoDoc: "6", numDoc: docCliente }
      : /^\d{8}$/.test(docCliente)
        ? { tipoDoc: "1", numDoc: docCliente }
        : { tipoDoc: "1", numDoc: "00000000" };
    qrContenido = qrSunatContenido({
      tipo: row.tipo,
      ruc: config.ruc,
      serie: row.serie,
      numero: String(row.correlativo).padStart(8, "0"),
      igv,
      total: monto,
      emision: row.emitidaAt,
      clienteTipo: cliente.tipoDoc,
      clienteNumero: cliente.numDoc,
    });
    qrPng = await generarQrPng(qrContenido);
  }

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generarPdfComprobante({
      tipo: row.tipo,
      serie: row.serie,
      correlativo: row.correlativo,
      sunatEstado: row.sunatEstado,
      sunatHash: row.sunatHash,
      emitidaAt: row.emitidaAt,
      createdAt: row.createdAt,
      monto,
      metodo: row.metodo,
      referencia: row.referencia,
      razonSocial: config?.razonSocial ?? ctx.team.name,
      ruc: config?.ruc ?? null,
      clienteNombre: paciente?.nombre ?? null,
      clienteDocumento: paciente?.documento ?? null,
      afectadoNumero: null,
      bajaMotivo: null,
      teamName: ctx.team.name,
      timezone: ctx.team.timezone,
      qrPng,
      qrContenido,
      logoPng,
    });
  } catch {
    return NextResponse.json({ error: "pdf_no_generado" }, { status: 500 });
  }

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${numero}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
