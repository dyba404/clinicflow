import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, waitlists } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

const TRANSICIONES: Record<string, string[]> = {
  activa: ["ofrecida", "retirada"],
  ofrecida: ["aceptada", "retirada", "activa"],
};

async function cargar(teamId: string, id: string) {
  const [row] = await getDb()
    .select()
    .from(waitlists)
    .where(and(eq(waitlists.id, id), eq(waitlists.tenantId, teamId)))
    .limit(1);
  return row ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("waitlist.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { estado?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const estado = body.estado;
  if (
    estado !== "ofrecida" &&
    estado !== "aceptada" &&
    estado !== "retirada" &&
    estado !== "activa"
  ) {
    return NextResponse.json({ error: "estado_invalido" }, { status: 400 });
  }

  const row = await cargar(g.team.id, id);
  if (!row) return NextResponse.json({ error: "no_encontrado" }, { status: 404 });

  if (!(TRANSICIONES[row.estado] ?? []).includes(estado)) {
    return NextResponse.json({ error: "transicion_invalida" }, { status: 400 });
  }

  await getDb()
    .update(waitlists)
    .set({ estado, updatedAt: new Date() })
    .where(eq(waitlists.id, id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "waitlist.estado",
    entidad: "waitlists",
    entidadId: id,
    payload: { de: row.estado, a: estado },
  });

  return NextResponse.json({ ok: true, id, estado });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("waitlist.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const row = await cargar(g.team.id, id);
  if (!row) return NextResponse.json({ error: "no_encontrado" }, { status: 404 });

  if (!(TRANSICIONES[row.estado] ?? []).includes("retirada")) {
    return NextResponse.json({ error: "transicion_invalida" }, { status: 400 });
  }

  await getDb()
    .update(waitlists)
    .set({ estado: "retirada", updatedAt: new Date() })
    .where(eq(waitlists.id, id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "waitlist.retirar",
    entidad: "waitlists",
    entidadId: id,
    payload: { de: row.estado },
  });

  return NextResponse.json({ ok: true, id, estado: "retirada" });
}
