import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb, staffSchedules, memberships } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface TurnoInput {
  dayOfWeek?: unknown;
  horaIni?: unknown;
  horaFin?: unknown;
}

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function validarTurnos(turnos: unknown):
  | { ok: true; valor: Array<{ dayOfWeek: number; horaIni: string; horaFin: string }> }
  | { ok: false; error: string } {
  if (!Array.isArray(turnos)) return { ok: false, error: "turnos_invalido" };
  const valor: Array<{ dayOfWeek: number; horaIni: string; horaFin: string }> = [];
  const vistos = new Set<string>();
  for (const t of turnos as TurnoInput[]) {
    const dayOfWeek = Number(t?.dayOfWeek);
    const horaIni = typeof t?.horaIni === "string" ? t.horaIni.trim() : "";
    const horaFin = typeof t?.horaFin === "string" ? t.horaFin.trim() : "";
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return { ok: false, error: "dia_invalido" };
    }
    if (!HORA_RE.test(horaIni) || !HORA_RE.test(horaFin)) {
      return { ok: false, error: "hora_invalida" };
    }
    if (horaIni >= horaFin) {
      return { ok: false, error: "rango_invalido" };
    }
    const clave = `${dayOfWeek}-${horaIni}`;
    if (vistos.has(clave)) return { ok: false, error: "turno_duplicado" };
    vistos.add(clave);
    valor.push({ dayOfWeek, horaIni, horaFin });
  }
  return { ok: true, valor };
}

async function esMiembroDelTeam(membershipId: string, teamId: string): Promise<boolean> {
  const rows = await getDb()
    .select({ teamId: memberships.teamId })
    .from(memberships)
    .where(eq(memberships.id, membershipId))
    .limit(1);
  return rows[0]?.teamId === teamId;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  const { membershipId } = await params;
  const g = await guardStaff("staff.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  if (!(await esMiembroDelTeam(membershipId, g.team.id))) {
    return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
  }

  const rows = await getDb()
    .select({
      dayOfWeek: staffSchedules.dayOfWeek,
      horaIni: staffSchedules.horaIni,
      horaFin: staffSchedules.horaFin,
    })
    .from(staffSchedules)
    .where(eq(staffSchedules.membershipId, membershipId))
    .orderBy(asc(staffSchedules.dayOfWeek), asc(staffSchedules.horaIni));

  return NextResponse.json({ turnos: rows });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  const { membershipId } = await params;
  const g = await guardStaff("staff.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { turnos?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const validado = validarTurnos(body.turnos);
  if (!validado.ok) {
    return NextResponse.json({ error: validado.error }, { status: 400 });
  }

  if (!(await esMiembroDelTeam(membershipId, g.team.id))) {
    return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(staffSchedules).where(eq(staffSchedules.membershipId, membershipId));
    if (validado.valor.length > 0) {
      await tx.insert(staffSchedules).values(
        validado.valor.map((t) => ({
          membershipId,
          dayOfWeek: t.dayOfWeek,
          horaIni: t.horaIni,
          horaFin: t.horaFin,
        })),
      );
    }
  });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "personal.horario",
    entidad: "staff_schedules",
    entidadId: membershipId,
    payload: { turnos: validado.valor.length },
  });

  return NextResponse.json({ ok: true, turnos: validado.valor });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  const { membershipId } = await params;
  const g = await guardStaff("staff.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  if (!(await esMiembroDelTeam(membershipId, g.team.id))) {
    return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
  }

  await getDb().delete(staffSchedules).where(eq(staffSchedules.membershipId, membershipId));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "personal.horario_limpiar",
    entidad: "staff_schedules",
    entidadId: membershipId,
  });

  return NextResponse.json({ ok: true });
}
