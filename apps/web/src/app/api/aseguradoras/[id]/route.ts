import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, insurers } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function buscarAseguradora(db: ReturnType<typeof getDb>, tenantId: string, id: string) {
  const [row] = await db
    .select({
      id: insurers.id,
      nombre: insurers.nombre,
      ruc: insurers.ruc,
      telefono: insurers.telefono,
      activo: insurers.activo,
    })
    .from(insurers)
    .where(and(eq(insurers.id, id), eq(insurers.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("insurers.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { nombre?: string; ruc?: string | null; telefono?: string | null; activo?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const db = getDb();
  const actual = await buscarAseguradora(db, g.team.id, id);
  if (!actual) {
    return NextResponse.json({ error: "aseguradora_no_encontrada" }, { status: 404 });
  }

  const cambios: {
    nombre?: string;
    ruc?: string | null;
    telefono?: string | null;
    activo?: boolean;
  } = {};

  if (typeof body.nombre !== "undefined") {
    const nombre = body.nombre?.trim() ?? "";
    if (!nombre || nombre.length > 80) {
      return NextResponse.json({ error: "nombre_invalido" }, { status: 400 });
    }
    cambios.nombre = nombre;
  }

  if (typeof body.ruc !== "undefined") {
    if (body.ruc === null || !body.ruc.trim()) {
      cambios.ruc = null;
    } else {
      const ruc = body.ruc.trim();
      if (!/^\d{11}$/.test(ruc)) {
        return NextResponse.json({ error: "ruc_invalido" }, { status: 400 });
      }
      cambios.ruc = ruc;
    }
  }

  if (typeof body.telefono !== "undefined") {
    if (body.telefono === null || !body.telefono.trim()) {
      cambios.telefono = null;
    } else {
      const telefono = body.telefono.trim();
      if (telefono.length > 30) {
        return NextResponse.json({ error: "telefono_invalido" }, { status: 400 });
      }
      cambios.telefono = telefono;
    }
  }

  if (typeof body.activo !== "undefined") {
    cambios.activo = Boolean(body.activo);
  }

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: "sin_cambios" }, { status: 400 });
  }

  const [row] = await db
    .update(insurers)
    .set(cambios)
    .where(and(eq(insurers.id, id), eq(insurers.tenantId, g.team.id)))
    .returning({
      id: insurers.id,
      nombre: insurers.nombre,
      ruc: insurers.ruc,
      telefono: insurers.telefono,
      activo: insurers.activo,
    });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "aseguradora.actualizar",
    entidad: "insurers",
    entidadId: id,
    payload: cambios,
  });

  return NextResponse.json({ ok: true, aseguradora: row });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("insurers.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const actual = await buscarAseguradora(db, g.team.id, id);
  if (!actual) {
    return NextResponse.json({ error: "aseguradora_no_encontrada" }, { status: 404 });
  }

  const [row] = await db
    .update(insurers)
    .set({ activo: false })
    .where(and(eq(insurers.id, id), eq(insurers.tenantId, g.team.id)))
    .returning({ id: insurers.id, activo: insurers.activo });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "aseguradora.desactivar",
    entidad: "insurers",
    entidadId: id,
    payload: { nombre: actual.nombre },
  });

  return NextResponse.json({ ok: true, id: row!.id, activo: row!.activo });
}
