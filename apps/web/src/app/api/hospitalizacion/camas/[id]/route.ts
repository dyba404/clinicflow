import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, beds } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ESTADOS = ["libre", "ocupada", "limpieza", "bloqueada"] as const;
type Estado = (typeof ESTADOS)[number];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("hospital.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { estado?: string; area?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const cambios: { estado?: Estado; area?: string | null } = {};
  if (typeof body.estado !== "undefined") {
    if (!ESTADOS.includes(body.estado as Estado)) {
      return NextResponse.json({ error: "estado_invalido" }, { status: 400 });
    }
    if (body.estado === "ocupada") {
      return NextResponse.json({ error: "estado_ocupada_solo_por_asignacion" }, { status: 400 });
    }
    cambios.estado = body.estado as Estado;
  }
  if (typeof body.area !== "undefined") {
    cambios.area = body.area.trim().slice(0, 80) || null;
  }
  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const db = getDb();
  const [cama] = await db
    .select({ id: beds.id, estado: beds.estado })
    .from(beds)
    .where(and(eq(beds.id, id), eq(beds.tenantId, g.team.id)))
    .limit(1);
  if (!cama) {
    return NextResponse.json({ error: "cama_no_encontrada" }, { status: 404 });
  }

  const [row] = await db
    .update(beds)
    .set(cambios)
    .where(and(eq(beds.id, id), eq(beds.tenantId, g.team.id)))
    .returning({ id: beds.id, estado: beds.estado });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "cama.estado",
    entidad: "beds",
    entidadId: id,
    payload: { de: cama.estado, a: cambios.estado ?? null, campos: Object.keys(cambios) },
  });

  return NextResponse.json({ ok: true, id: row!.id, estado: row!.estado });
}
