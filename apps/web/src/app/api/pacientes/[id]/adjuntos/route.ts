import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { getDb, attachments, patients } from "@clinicflow/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";
import { attachmentsRoot } from "@/lib/attachments";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MIME_FOTO = ["image/jpeg", "image/png", "image/webp"];
const FOTO_TIPOS = ["antes", "despues", "progreso"] as const;

export async function POST(req: Request) {
  let g = await guardStaff("records.edit_partial");
  if (!g.ok) {
    g = await guardStaff("records.edit");
    if (!g.ok) {
      return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
    }
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "form_invalido" }, { status: 400 });
  }

  const file = form.get("archivo");
  const patientId = form.get("patientId");
  const appointmentId = form.get("appointmentId");
  const tipo = form.get("tipo");
  const nota = form.get("nota");
  const fotoTipoRaw = form.get("fotoTipo");
  const tratamientoRaw = form.get("tratamiento");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "archivo_requerido" }, { status: 400 });
  }
  if (typeof patientId !== "string" || !patientId) {
    return NextResponse.json({ error: "paciente_requerido" }, { status: 400 });
  }
  const tipoVal = typeof tipo === "string" && tipo === "rx" ? "rx" : "otro";

  const fotoTipo =
    typeof fotoTipoRaw === "string" && FOTO_TIPOS.includes(fotoTipoRaw as (typeof FOTO_TIPOS)[number])
      ? (fotoTipoRaw as (typeof FOTO_TIPOS)[number])
      : null;
  const tratamiento =
    typeof tratamientoRaw === "string" && tratamientoRaw.trim()
      ? tratamientoRaw.trim().slice(0, 80)
      : null;
  if (typeof fotoTipoRaw === "string" && !fotoTipo) {
    return NextResponse.json({ error: "foto_tipo_invalido" }, { status: 400 });
  }
  if (fotoTipo && tipoVal !== "otro") {
    return NextResponse.json({ error: "foto_debe_ser_tipo_otro" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "archivo_muy_grande" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(buffer);
  const mime = detected?.mime ?? file.type;
  if (!ALLOWED_MIME.includes(mime)) {
    return NextResponse.json({ error: "formato_no_permitido" }, { status: 415 });
  }
  if (fotoTipo && !MIME_FOTO.includes(mime)) {
    return NextResponse.json({ error: "foto_solo_imagen" }, { status: 415 });
  }

  const db = getDb();
  const [paciente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) {
    return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
  }

  const id = randomUUID();
  const ext = detected?.ext ?? "bin";
  const dir = join(attachmentsRoot(), g.team.id);
  const filePath = join(dir, `${id}.${ext}`);
  if (!filePath.startsWith(attachmentsRoot() + sep)) {
    return NextResponse.json({ error: "ruta_invalida" }, { status: 400 });
  }
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, buffer);

  let fotoOrden: number | null = null;
  if (fotoTipo) {
    const condiciones = [
      eq(attachments.tenantId, g.team.id),
      eq(attachments.patientId, paciente.id),
      eq(attachments.fotoTipo, fotoTipo),
    ];
    if (tratamiento) {
      condiciones.push(eq(attachments.tratamiento, tratamiento));
    } else {
      condiciones.push(isNull(attachments.tratamiento));
    }
    const [maxRow] = await db
      .select({ maximo: sql<number>`coalesce(max(${attachments.fotoOrden}), 0)`.mapWith(Number) })
      .from(attachments)
      .where(and(...condiciones));
    fotoOrden = (maxRow?.maximo ?? 0) + 1;
  }

  const [row] = await db
    .insert(attachments)
    .values({
      tenantId: g.team.id,
      patientId: paciente.id,
      appointmentId: typeof appointmentId === "string" && appointmentId ? appointmentId : null,
      tipo: tipoVal,
      fotoTipo,
      fotoOrden,
      tratamiento: fotoTipo ? tratamiento : null,
      nombre: file.name || `adjunto.${ext}`,
      mime,
      sizeBytes: buffer.length,
      storagePath: filePath,
      nota: typeof nota === "string" && nota.trim() ? nota.trim() : null,
      createdBy: g.user.id,
    })
    .returning({ id: attachments.id, createdAt: attachments.createdAt });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "adjunto.subir",
    entidad: "attachments",
    entidadId: row!.id,
    payload: {
      tipo: tipoVal,
      mime,
      size: buffer.length,
      ...(fotoTipo ? { fotoTipo, tratamiento, fotoOrden } : {}),
    },
  });

  return NextResponse.json({ ok: true, id: row!.id }, { status: 201 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("records.view");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [paciente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) {
    return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
  }

  const rows = await db
    .select({
      id: attachments.id,
      tipo: attachments.tipo,
      nombre: attachments.nombre,
      mime: attachments.mime,
      sizeBytes: attachments.sizeBytes,
      nota: attachments.nota,
      createdAt: attachments.createdAt,
    })
    .from(attachments)
    .where(and(eq(attachments.patientId, id), eq(attachments.tenantId, g.team.id)))
    .orderBy(desc(attachments.createdAt));

  return NextResponse.json({ adjuntos: rows });
}
