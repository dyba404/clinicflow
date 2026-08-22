import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb, services } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

function parseBody(body: {
  nombre?: string;
  duracionMin?: number;
  precio?: number;
  bufferMin?: number;
  activo?: boolean;
}) {
  const nombre = body.nombre?.trim();
  if (
    typeof body.nombre !== "string" ||
    !nombre ||
    nombre.length < 1 ||
    nombre.length > 80
  ) {
    return { error: "nombre_invalido" } as const;
  }
  const duracionMin = Number(body.duracionMin);
  if (!Number.isInteger(duracionMin) || duracionMin < 5 || duracionMin > 480) {
    return { error: "duracion_invalida" } as const;
  }
  const precio = Number(body.precio);
  if (!Number.isFinite(precio) || precio < 0) {
    return { error: "precio_invalido" } as const;
  }
  let bufferMin: number | undefined;
  if (body.bufferMin !== undefined) {
    bufferMin = Number(body.bufferMin);
    if (!Number.isInteger(bufferMin) || bufferMin < 0) {
      return { error: "buffer_invalido" } as const;
    }
  }
  let activo: boolean | undefined;
  if (body.activo !== undefined) {
    if (typeof body.activo !== "boolean") {
      return { error: "activo_invalido" } as const;
    }
    activo = body.activo;
  }
  return { values: { nombre, duracionMin, precio, bufferMin, activo } } as const;
}

export async function GET() {
  const g = await guardStaff();
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const rows = await getDb()
    .select({
      id: services.id,
      nombre: services.nombre,
      duracionMin: services.duracionMin,
      precio: services.precio,
      bufferMin: services.bufferMin,
      activo: services.activo,
    })
    .from(services)
    .where(eq(services.tenantId, g.team.id))
    .orderBy(asc(services.nombre));
  return NextResponse.json({ servicios: rows });
}

export async function POST(req: Request) {
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

  const parsed = parseBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const [row] = await getDb()
    .insert(services)
    .values({
      tenantId: g.team.id,
      nombre: parsed.values.nombre,
      duracionMin: parsed.values.duracionMin,
      precio: parsed.values.precio.toFixed(2),
      bufferMin: parsed.values.bufferMin ?? 0,
      activo: parsed.values.activo ?? true,
      createdBy: g.user.id,
    })
    .returning({
      id: services.id,
      nombre: services.nombre,
      duracionMin: services.duracionMin,
      precio: services.precio,
      bufferMin: services.bufferMin,
      activo: services.activo,
    });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "servicio.crear",
    entidad: "services",
    entidadId: row!.id,
    payload: { nombre: row!.nombre, activo: row!.activo },
  });

  return NextResponse.json({ ok: true, servicio: row }, { status: 201 });
}
