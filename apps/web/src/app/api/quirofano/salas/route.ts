import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb, surgeryRooms } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  const g = await guardStaff("surgery.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const salas = await getDb()
    .select({ id: surgeryRooms.id, nombre: surgeryRooms.nombre, activo: surgeryRooms.activo })
    .from(surgeryRooms)
    .where(eq(surgeryRooms.tenantId, g.team.id))
    .orderBy(asc(surgeryRooms.nombre));

  return NextResponse.json({ salas });
}

export async function POST(req: Request) {
  const g = await guardStaff("surgery.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { nombre?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim() ?? "";
  if (nombre.length < 2) {
    return NextResponse.json({ error: "nombre_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [duplicada] = await db
    .select({ id: surgeryRooms.id })
    .from(surgeryRooms)
    .where(and(eq(surgeryRooms.tenantId, g.team.id), eq(surgeryRooms.nombre, nombre)))
    .limit(1);
  if (duplicada) {
    return NextResponse.json({ error: "sala_repetida" }, { status: 409 });
  }

  const [row] = await db
    .insert(surgeryRooms)
    .values({ tenantId: g.team.id, nombre })
    .returning({ id: surgeryRooms.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "sala.crear",
    entidad: "surgery_rooms",
    entidadId: row!.id,
    payload: { nombre },
  });

  return NextResponse.json({ ok: true, id: row!.id }, { status: 201 });
}
