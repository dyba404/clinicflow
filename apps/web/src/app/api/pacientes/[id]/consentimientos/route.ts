import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { and, eq } from "drizzle-orm";
import { getDb, attachments, patients, signedConsents } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";
import { attachmentsRoot } from "@/lib/attachments";
import { fechaLargaEs } from "@/lib/notify";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const g = await guardStaff("records.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    firmaBase64Png?: string;
    servicioNombre?: string;
    citaId?: string | null;
    declaracion?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const firma = body.firmaBase64Png ?? "";
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(firma);
  if (!match?.[1]) {
    return NextResponse.json({ error: "firma_invalida" }, { status: 400 });
  }
  const pngBytes = Buffer.from(match[1], "base64");
  if (pngBytes.length > 512 * 1024) {
    return NextResponse.json({ error: "firma_muy_grande" }, { status: 413 });
  }
  const servicioNombre = body.servicioNombre?.trim() || "Atención clínica";
  const declaracion =
    body.declaracion?.trim() ||
    "Declaro haber sido informado/a del procedimiento, sus riesgos y alternativas, y doy mi consentimiento para su realización.";

  const db = getDb();
  const [paciente] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) {
    return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
  }

  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: g.team.timezone }).format(new Date());
  const fechaLarga = fechaLargaEs(hoy);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const teal = rgb(13 / 255, 148 / 255, 136 / 255);

  page.drawText(g.team.name, { x: 48, y: 794, size: 11, font, color: rgb(0.45, 0.45, 0.45) });
  page.drawText("Consentimiento informado", { x: 48, y: 760, size: 20, font: fontBold });
  page.drawText("Clinicflow", { x: 48, y: 744, size: 10, font, color: teal });

  let y = 700;
  const lineas = [
    `Paciente: ${paciente.nombre}`,
    `Documento: ${paciente.documento ?? "—"}`,
    `Servicio: ${servicioNombre}`,
    `Fecha: ${fechaLarga}`,
    "",
    declaracion,
    "",
    "Firma del paciente:",
  ];
  for (const linea of lineas) {
    const maxChars = 100;
    if (linea.length > maxChars) {
      for (let i = 0; i < linea.length; i += maxChars) {
        page.drawText(linea.slice(i, i + maxChars), { x: 48, y, size: 11, font });
        y -= 16;
      }
    } else {
      page.drawText(linea, { x: 48, y, size: 11, font });
      y -= 16;
    }
  }

  const firmaPng = await pdf.embedPng(pngBytes);
  const escala = Math.min(200 / firmaPng.width, 60 / firmaPng.height);
  page.drawImage(firmaPng, {
    x: 48,
    y: y - 8,
    width: firmaPng.width * escala,
    height: firmaPng.height * escala,
  });
  y -= 90;

  page.drawLine({
    start: { x: 48, y },
    end: { x: 260, y },
    thickness: 0.75,
    color: rgb(0, 0, 0),
  });
  y -= 14;
  page.drawText(`${paciente.nombre} — firmado digitalmente`, { x: 48, y, size: 9, font });
  page.drawText(`Registrado por: ${g.user.name}`, { x: 48, y: y - 12, size: 9, font, color: rgb(0.45, 0.45, 0.45) });

  const pdfBytes = await pdf.save();
  const attachmentId = randomUUID();
  const dir = join(attachmentsRoot(), g.team.id);
  await mkdir(dir, { recursive: true });
  const storagePath = join(dir, `consentimiento-${attachmentId}.pdf`);
  await writeFile(storagePath, pdfBytes);

  const [attachment] = await db
    .insert(attachments)
    .values({
      tenantId: g.team.id,
      patientId: paciente.id,
      appointmentId: body.citaId ?? null,
      tipo: "consentimiento",
      nombre: `consentimiento-${hoy}.pdf`,
      mime: "application/pdf",
      sizeBytes: pdfBytes.length,
      storagePath,
      nota: servicioNombre,
      createdBy: g.user.id,
    })
    .returning({ id: attachments.id });

  const [consent] = await db
    .insert(signedConsents)
    .values({
      tenantId: g.team.id,
      patientId: paciente.id,
      citaId: body.citaId ?? null,
      servicioNombre,
      attachmentId: attachment!.id,
      signedBy: paciente.nombre,
    })
    .returning({ id: signedConsents.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "consentimiento.firmar",
    entidad: "signed_consents",
    entidadId: consent!.id,
    payload: { servicioNombre },
  });

  return NextResponse.json({ ok: true, id: consent!.id, attachmentId: attachment!.id }, { status: 201 });
}
