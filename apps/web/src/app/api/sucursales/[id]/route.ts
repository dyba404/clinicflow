import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, branches } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const g = await guardStaff("branches.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    nombre?: string;
    direccion?: string | null;
    telefono?: string | null;
    activo?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const updates: {
    nombre?: string;
    direccion?: string | null;
    telefono?: string | null;
    activo?: boolean;
  } = {};

  if (body.nombre !== undefined) {
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    if (!nombre || nombre.length > 60) {
      return NextResponse.json({ error: "nombre_invalido" }, { status: 400 });
    }
    updates.nombre = nombre;
  }
  if (body.direccion !== undefined) {
    updates.direccion = body.direccion?.trim() || null;
  }
  if (body.telefono !== undefined) {
    updates.telefono = body.telefono?.trim() || null;
  }
  if (body.activo !== undefined) {
    if (typeof body.activo !== "boolean") {
      return NextResponse.json({ error: "activo_invalido" }, { status: 400 });
    }
    updates.activo = body.activo;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "sin_cambios" }, { status: 400 });
  }

  const db = getDb();
  const [existente] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, id), eq(branches.tenantId, g.team.id)))
    .limit(1);
  if (!existente) {
    return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
  }

  await db
    .update(branches)
    .set(updates)
    .where(and(eq(branches.id, id), eq(branches.tenantId, g.team.id)));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "sucursal.editar",
    entidad: "branches",
    entidadId: id,
    payload: { cambios: Object.keys(updates) },
  });

  return NextResponse.json({ ok: true, id });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const g = await guardStaff("branches.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [existente] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, id), eq(branches.tenantId, g.team.id)))
    .limit(1);
  if (!existente) {
    return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
  }

  await db
    .update(branches)
    .set({ activo: false })
    .where(and(eq(branches.id, id), eq(branches.tenantId, g.team.id)));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "sucursal.desactivar",
    entidad: "branches",
    entidadId: id,
    payload: { activo: false },
  });

  return NextResponse.json({ ok: true, id });
}
