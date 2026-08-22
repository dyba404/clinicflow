import { NextResponse } from "next/server";
import { and, eq, gte, lt } from "drizzle-orm";
import { getDb, surgeries, surgeryRooms } from "@clinicflow/db";
import { guardStaff, guardError, hoyTenant } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("surgery.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { activo?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (typeof body.activo === "undefined") {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const db = getDb();
  const [sala] = await db
    .select({ id: surgeryRooms.id, nombre: surgeryRooms.nombre, activo: surgeryRooms.activo })
    .from(surgeryRooms)
    .where(and(eq(surgeryRooms.id, id), eq(surgeryRooms.tenantId, g.team.id)))
    .limit(1);
  if (!sala) {
    return NextResponse.json({ error: "sala_no_encontrada" }, { status: 404 });
  }

  if (body.activo === false && sala.activo) {
    const hoy = await hoyTenant(g.team.timezone);
    const desde = new Date(`${hoy}T00:00:00`);
    const hasta = new Date(desde.getTime() + 24 * 3600_000);
    const [reservada] = await db
      .select({ id: surgeries.id })
      .from(surgeries)
      .where(
        and(
          eq(surgeries.tenantId, g.team.id),
          eq(surgeries.roomId, sala.id),
          eq(surgeries.estado, "programada"),
          gte(surgeries.scheduledAt, desde),
          lt(surgeries.scheduledAt, hasta),
        ),
      )
      .limit(1);
    if (reservada) {
      return NextResponse.json({ error: "sala_en_uso" }, { status: 409 });
    }
  }

  const [row] = await db
    .update(surgeryRooms)
    .set({ activo: body.activo })
    .where(and(eq(surgeryRooms.id, id), eq(surgeryRooms.tenantId, g.team.id)))
    .returning({ id: surgeryRooms.id, activo: surgeryRooms.activo });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "sala.estado",
    entidad: "surgery_rooms",
    entidadId: id,
    payload: { activo: body.activo },
  });

  return NextResponse.json({ ok: true, id: row!.id, activo: row!.activo });
}
