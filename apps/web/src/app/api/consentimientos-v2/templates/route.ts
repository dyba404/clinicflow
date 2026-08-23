import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, consentTemplates } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardStaff("records.view");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const rows = await getDb()
    .select()
    .from(consentTemplates)
    .where(eq(consentTemplates.tenantId, g.team.id))
    .orderBy(desc(consentTemplates.activo), desc(consentTemplates.createdAt));

  return NextResponse.json({ templates: rows });
}

export async function POST(req: Request) {
  const g = await guardStaff("records.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { nombre?: string; tratamiento?: string | null; contenido?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim();
  const contenido = body.contenido?.trim();
  if (!nombre || nombre.length > 120) return NextResponse.json({ error: "nombre_invalido" }, { status: 400 });
  if (!contenido || contenido.length > 20000) return NextResponse.json({ error: "contenido_invalido" }, { status: 400 });

  const db = getDb();
  const [dup] = await db
    .select({ id: consentTemplates.id })
    .from(consentTemplates)
    .where(and(eq(consentTemplates.tenantId, g.team.id), eq(consentTemplates.nombre, nombre)))
    .limit(1);
  if (dup) return NextResponse.json({ error: "nombre_ya_existe" }, { status: 409 });

  const [row] = await db
    .insert(consentTemplates)
    .values({
      tenantId: g.team.id,
      nombre,
      tratamiento: body.tratamiento?.trim() || null,
      contenido,
      createdBy: g.user.id,
    })
    .returning({ id: consentTemplates.id, nombre: consentTemplates.nombre });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "consentimiento.template_crear",
    entidad: "consent_templates",
    entidadId: row!.id,
    payload: { nombre },
  });

  return NextResponse.json({ ok: true, template: row }, { status: 201 });
}
