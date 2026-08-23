import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getDb, consentTemplates, consentSigns } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("records.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { nombre?: string; tratamiento?: string | null; contenido?: string; activo?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.nombre === "string") {
    const nombre = body.nombre.trim();
    if (!nombre || nombre.length > 120) return NextResponse.json({ error: "nombre_invalido" }, { status: 400 });
    set.nombre = nombre;
  }
  if (typeof body.tratamiento === "string" || body.tratamiento === null) {
    set.tratamiento = body.tratamiento?.trim() || null;
  }
  if (typeof body.contenido === "string") {
    const contenido = body.contenido.trim();
    if (!contenido || contenido.length > 20000) return NextResponse.json({ error: "contenido_invalido" }, { status: 400 });
    set.contenido = contenido;
  }
  if (typeof body.activo === "boolean") set.activo = body.activo;

  const db = getDb();
  const [row] = await db
    .update(consentTemplates)
    .set(set)
    .where(and(eq(consentTemplates.id, id), eq(consentTemplates.tenantId, g.team.id)))
    .returning({ id: consentTemplates.id });
  if (!row) return NextResponse.json({ error: "template_no_encontrado" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("records.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [firmas] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(consentSigns)
    .where(and(eq(consentSigns.templateId, id), eq(consentSigns.tenantId, g.team.id)));
  if (firmas && firmas.n > 0) {
    return NextResponse.json({ error: "template_con_firmas" }, { status: 400 });
  }

  const [row] = await db
    .delete(consentTemplates)
    .where(and(eq(consentTemplates.id, id), eq(consentTemplates.tenantId, g.team.id)))
    .returning({ id: consentTemplates.id });
  if (!row) return NextResponse.json({ error: "template_no_encontrado" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
