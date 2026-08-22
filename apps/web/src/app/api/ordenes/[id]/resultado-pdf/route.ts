import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { and, asc, eq } from "drizzle-orm";
import { getDb, attachments, orders, orderResults, patients, users } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";
import { attachmentsRoot } from "@/lib/attachments";

export const dynamic = "force-dynamic";

const ESTADOS_LIBERADOS = ["liberada", "entregada"];

const ESTADO_LABEL: Record<string, string> = {
  liberada: "Liberada",
  entregada: "Entregada",
};

interface OrdenPdf {
  id: string;
  appointmentId: string | null;
  patientId: string;
  nombre: string;
  estado: string;
  createdAt: Date;
  validadoPorNombre: string | null;
}

interface FilaPdf {
  parametro: string;
  valorText: string | null;
  valorNum: string | null;
  unidad: string | null;
  referencia: string | null;
  flag: string | null;
}

async function cargarOrden(id: string, tenantId: string) {
  const [orden] = await getDb()
    .select({
      id: orders.id,
      appointmentId: orders.appointmentId,
      patientId: orders.patientId,
      nombre: orders.nombre,
      estado: orders.estado,
      createdAt: orders.createdAt,
      patientNombre: patients.nombre,
      validadoPorNombre: users.name,
    })
    .from(orders)
    .innerJoin(patients, eq(orders.patientId, patients.id))
    .leftJoin(users, eq(orders.validadoPor, users.id))
    .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)))
    .limit(1);
  return orden ?? null;
}

async function pdfResultado(opts: {
  clinica: string;
  timezone: string;
  orden: OrdenPdf & { patientNombre: string };
  filas: FilaPdf[];
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const teal = rgb(13 / 255, 148 / 255, 136 / 255);
  const gris = rgb(0.45, 0.45, 0.45);

  page.drawRectangle({ x: 0, y: 790, width: 595, height: 52, color: teal });
  page.drawText(opts.clinica, { x: 48, y: 814, size: 16, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Resultado de laboratorio", { x: 48, y: 798, size: 9, font, color: rgb(0.9, 1, 0.98) });
  const estadoLabel = ESTADO_LABEL[opts.orden.estado] ?? opts.orden.estado;
  page.drawText(estadoLabel, { x: 547 - fontBold.widthOfTextAtSize(estadoLabel, 11), y: 806, size: 11, font: fontBold, color: rgb(1, 1, 1) });

  const fecha = new Intl.DateTimeFormat("es-PE", {
    timeZone: opts.timezone,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(opts.orden.createdAt);

  let y = 760;
  page.drawText(`Paciente: ${opts.orden.patientNombre}`, { x: 48, y, size: 11, font: fontBold });
  y -= 16;
  page.drawText(`Estudio: ${opts.orden.nombre}`, { x: 48, y, size: 11, font });
  y -= 16;
  page.drawText(`Fecha: ${fecha}`, { x: 48, y, size: 11, font });
  y -= 16;
  if (opts.orden.validadoPorNombre) {
    page.drawText(`Validado por: ${opts.orden.validadoPorNombre}`, { x: 48, y, size: 11, font });
    y -= 16;
  }
  y -= 10;

  const cols = [
    { x: 48, w: 150, label: "Parámetro" },
    { x: 210, w: 90, label: "Valor" },
    { x: 310, w: 45, label: "Unidad" },
    { x: 365, w: 110, label: "Referencia" },
    { x: 485, w: 60, label: "Flag" },
  ];

  const cortar = (texto: string, x: number, w: number, size: number, f: typeof font) => {
    let t = texto;
    while (f.widthOfTextAtSize(t, size) > w && t.length > 1) t = t.slice(0, -1);
    return t === texto ? t : `${t.slice(0, -1)}…`;
  };

  for (const c of cols) {
    page.drawText(c.label, { x: c.x, y, size: 9, font: fontBold, color: teal });
  }
  page.drawLine({ start: { x: 48, y: y - 4 }, end: { x: 547, y: y - 4 }, thickness: 0.75, color: teal });
  y -= 18;

  for (const f of opts.filas) {
    const valor = f.valorText ?? (f.valorNum !== null ? String(Number(f.valorNum)) : "");
    const celdas = [f.parametro, valor, f.unidad ?? "", f.referencia ?? "", f.flag ?? ""];
    cols.forEach((c, i) => {
      page.drawText(cortar(celdas[i] ?? "", c.x, c.w, 9, font), {
        x: c.x,
        y,
        size: 9,
        font,
        color: i === 4 && celdas[i] ? rgb(0.7, 0.1, 0.1) : rgb(0, 0, 0),
      });
    });
    y -= 14;
    if (y < 70) break;
  }

  page.drawText(`Generado por Clinicflow el ${new Intl.DateTimeFormat("es-PE", {
    timeZone: opts.timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date())}`, { x: 48, y: 40, size: 8, font, color: gris });

  return { bytes: await pdf.save(), fecha };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("labs.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const orden = await cargarOrden(id, g.team.id);
  if (!orden) {
    return NextResponse.json({ error: "orden_no_encontrada" }, { status: 404 });
  }
  if (!ESTADOS_LIBERADOS.includes(orden.estado)) {
    return NextResponse.json({ error: "pdf_no_liberado" }, { status: 409 });
  }

  const filas = await getDb()
    .select()
    .from(orderResults)
    .where(eq(orderResults.orderId, orden.id))
    .orderBy(asc(orderResults.createdAt));

  const { bytes } = await pdfResultado({
    clinica: g.team.name,
    timezone: g.team.timezone,
    orden,
    filas,
  });

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="resultado-lab-${orden.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("labs.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const orden = await cargarOrden(id, g.team.id);
  if (!orden) {
    return NextResponse.json({ error: "orden_no_encontrada" }, { status: 404 });
  }
  if (!ESTADOS_LIBERADOS.includes(orden.estado)) {
    return NextResponse.json({ error: "pdf_no_liberado" }, { status: 409 });
  }

  const filas = await getDb()
    .select()
    .from(orderResults)
    .where(eq(orderResults.orderId, orden.id))
    .orderBy(asc(orderResults.createdAt));

  const { bytes, fecha } = await pdfResultado({
    clinica: g.team.name,
    timezone: g.team.timezone,
    orden,
    filas,
  });

  const attachmentId = randomUUID();
  const dir = join(attachmentsRoot(), g.team.id);
  await mkdir(dir, { recursive: true });
  const storagePath = join(dir, `resultado-lab-${attachmentId}.pdf`);
  await writeFile(storagePath, bytes);

  const db = getDb();
  const [att] = await db
    .insert(attachments)
    .values({
      tenantId: g.team.id,
      patientId: orden.patientId,
      appointmentId: orden.appointmentId,
      tipo: "otro",
      nombre: `resultado-lab-${fecha.replaceAll(" ", "_")}.pdf`,
      mime: "application/pdf",
      sizeBytes: bytes.length,
      storagePath,
      nota: orden.nombre,
      createdBy: g.user.id,
    })
    .returning({ id: attachments.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "resultado.pdf",
    entidad: "attachments",
    entidadId: att!.id,
    payload: { orderId: orden.id },
  });

  return NextResponse.json({ ok: true, url: `/api/adjuntos/${att!.id}` }, { status: 201 });
}
