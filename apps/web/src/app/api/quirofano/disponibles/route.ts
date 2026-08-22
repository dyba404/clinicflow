import { NextResponse } from "next/server";
import { and, asc, eq, gte, inArray, lt, not } from "drizzle-orm";
import { getDb, surgeries, surgeryRooms } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";

export const dynamic = "force-dynamic";

const HORA_RE = /^(\d{1,2}):(\d{2})$/;
const MARGEN_MS = 30 * 60_000;

function minutos(hora: string): number | null {
  const m = HORA_RE.exec(hora);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export async function GET(req: Request) {
  const g = await guardStaff("surgery.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const url = new URL(req.url);
  const fecha = url.searchParams.get("fecha") ?? "";
  const horaIni = url.searchParams.get("horaIni") ?? "";
  const horaFin = url.searchParams.get("horaFin") ?? "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
  }
  const iniMin = minutos(horaIni);
  if (iniMin === null) {
    return NextResponse.json({ error: "hora_invalida" }, { status: 400 });
  }
  const finMin = horaFin ? minutos(horaFin) : iniMin + 60;
  if (finMin === null || finMin <= iniMin) {
    return NextResponse.json({ error: "hora_invalida" }, { status: 400 });
  }

  const db = getDb();
  const salas = await db
    .select({ id: surgeryRooms.id, nombre: surgeryRooms.nombre })
    .from(surgeryRooms)
    .where(and(eq(surgeryRooms.tenantId, g.team.id), eq(surgeryRooms.activo, true)))
    .orderBy(asc(surgeryRooms.nombre));
  if (salas.length === 0) {
    return NextResponse.json({ salas: [] });
  }

  const desde = new Date(`${fecha}T00:00:00`);
  const ventanaDesde = new Date(desde.getTime() + iniMin * 60_000 - MARGEN_MS);
  const ventanaHasta = new Date(desde.getTime() + finMin * 60_000 + MARGEN_MS);

  const ocupadas = await db
    .select({ roomId: surgeries.roomId })
    .from(surgeries)
    .where(
      and(
        eq(surgeries.tenantId, g.team.id),
        inArray(
          surgeries.roomId,
          salas.map((s) => s.id),
        ),
        not(inArray(surgeries.estado, ["cancelada", "completada"])),
        gte(surgeries.scheduledAt, ventanaDesde),
        lt(surgeries.scheduledAt, ventanaHasta),
      ),
    );

  const ocupadoIds = new Set(ocupadas.map((o) => o.roomId));
  return NextResponse.json({
    salas: salas.filter((s) => !ocupadoIds.has(s.id)),
  });
}
