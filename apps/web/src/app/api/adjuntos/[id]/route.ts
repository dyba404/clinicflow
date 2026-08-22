import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { getDb, attachments } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

const MIME_FOTO = ["image/jpeg", "image/png", "image/webp"];
const FOTO_TIPOS = ["antes", "despues", "progreso"] as const;

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("records.view");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const [att] = await getDb()
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.tenantId, g.team.id)))
    .limit(1);
  if (!att || !att.storagePath) {
    return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
  }

  try {
    const data = await readFile(att.storagePath);
    const nombre = att.nombre.replace(/["\\]/g, "_");
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": att.mime || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(nombre)}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "archivo_no_existente" }, { status: 410 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("records.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { fotoTipo?: string; tratamiento?: string; fotoOrden?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const fotoTipo =
    typeof body.fotoTipo === "string" &&
    FOTO_TIPOS.includes(body.fotoTipo as (typeof FOTO_TIPOS)[number])
      ? (body.fotoTipo as (typeof FOTO_TIPOS)[number])
      : null;
  if (typeof body.fotoTipo === "string" && !fotoTipo) {
    return NextResponse.json({ error: "foto_tipo_invalido" }, { status: 400 });
  }
  const tratamiento =
    typeof body.tratamiento === "string" && body.tratamiento.trim()
      ? body.tratamiento.trim().slice(0, 80)
      : null;
  const fotoOrden =
    typeof body.fotoOrden === "number" &&
    Number.isInteger(body.fotoOrden) &&
    body.fotoOrden >= 0
      ? body.fotoOrden
      : null;
  if (body.fotoOrden !== undefined && fotoOrden === null) {
    return NextResponse.json({ error: "foto_orden_invalido" }, { status: 400 });
  }
  if (fotoTipo === null && tratamiento === null && fotoOrden === null) {
    return NextResponse.json({ error: "campos_requeridos" }, { status: 400 });
  }

  const db = getDb();
  const [att] = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.tenantId, g.team.id)))
    .limit(1);
  if (!att) {
    return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
  }

  const esFoto = att.fotoTipo !== null && FOTO_TIPOS.includes(att.fotoTipo as (typeof FOTO_TIPOS)[number]);
  if (fotoOrden !== null && !esFoto) {
    return NextResponse.json({ error: "foto_orden_solo_fotos" }, { status: 400 });
  }

  const setFoto = fotoTipo ?? att.fotoTipo;
  if (setFoto && !MIME_FOTO.includes(att.mime)) {
    return NextResponse.json({ error: "foto_solo_imagen" }, { status: 415 });
  }

  const [row] = await db
    .update(attachments)
    .set({
      ...(fotoTipo !== null ? { fotoTipo: fotoTipo } : {}),
      ...(tratamiento !== null ? { tratamiento } : {}),
      ...(fotoOrden !== null ? { fotoOrden } : {}),
    })
    .where(and(eq(attachments.id, id), eq(attachments.tenantId, g.team.id)))
    .returning({
      id: attachments.id,
      fotoTipo: attachments.fotoTipo,
      fotoOrden: attachments.fotoOrden,
      tratamiento: attachments.tratamiento,
    });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "adjunto.actualizar",
    entidad: "attachments",
    entidadId: id,
    payload: {
      fotoTipo: row!.fotoTipo,
      fotoOrden: row!.fotoOrden,
      tratamiento: row!.tratamiento,
    },
  });

  return NextResponse.json({
    ok: true,
    fotoTipo: row!.fotoTipo,
    fotoOrden: row!.fotoOrden,
    tratamiento: row!.tratamiento,
  });
}
