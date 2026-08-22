import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, services } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const g = await guardStaff("services.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    nombre?: string;
    duracionMin?: number;
    precio?: number;
    bufferMin?: number;
    activo?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const updates: {
    nombre?: string;
    duracionMin?: number;
    precio?: string;
    bufferMin?: number;
    activo?: boolean;
  } = {};

  if (body.nombre !== undefined) {
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    if (!nombre || nombre.length > 80) {
      return NextResponse.json({ error: "nombre_invalido" }, { status: 400 });
    }
    updates.nombre = nombre;
  }
  if (body.duracionMin !== undefined) {
    const duracionMin = Number(body.duracionMin);
    if (!Number.isInteger(duracionMin) || duracionMin < 5 || duracionMin > 480) {
      return NextResponse.json({ error: "duracion_invalida" }, { status: 400 });
    }
    updates.duracionMin = duracionMin;
  }
  if (body.precio !== undefined) {
    const precio = Number(body.precio);
    if (!Number.isFinite(precio) || precio < 0) {
      return NextResponse.json({ error: "precio_invalido" }, { status: 400 });
    }
    updates.precio = precio.toFixed(2);
  }
  if (body.bufferMin !== undefined) {
    const bufferMin = Number(body.bufferMin);
    if (!Number.isInteger(bufferMin) || bufferMin < 0) {
      return NextResponse.json({ error: "buffer_invalido" }, { status: 400 });
    }
    updates.bufferMin = bufferMin;
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
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.id, id), eq(services.tenantId, g.team.id)))
    .limit(1);
  if (!existente) {
    return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
  }

  await db.update(services).set(updates).where(eq(services.id, id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "servicio.editar",
    entidad: "services",
    entidadId: id,
    payload: { cambios: Object.keys(updates) },
  });

  return NextResponse.json({ ok: true, id });
}
