import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getDb, users, memberships, teams, staffSchedules } from "@clinicflow/db";
import { verifyPassword, createSession, SESSION_COOKIE, sessionCookieBase } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { rateLimit, ipReq } from "@/lib/rate-limit";

function fueraDeTurno(timezone: string, turnos: Array<{ dayOfWeek: number; horaIni: string; horaFin: string }>): boolean {
  if (turnos.length === 0) return false;
  const ahora = new Date();
  const fechaLocal = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(ahora);
  const dia = new Date(`${fechaLocal}T12:00:00Z`).getUTCDay();
  const hora = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(ahora);
  return !turnos.some(
    (t) => t.dayOfWeek === dia && hora >= t.horaIni.slice(0, 5) && hora < t.horaFin.slice(0, 5),
  );
}

export async function POST(req: Request) {
  const limite = rateLimit(`login:${ipReq(req)}`, 10);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  let body: { email?: string; password?: string; teamSlug?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "credenciales_invalidas" }, { status: 401 });
  }

  if (user.lockedAt) {
    return NextResponse.json({ error: "cuenta_bloqueada" }, { status: 403 });
  }

  const membresias = await db
    .select({
      membershipId: memberships.id,
      teamId: memberships.teamId,
      role: memberships.role,
      teamSlug: teams.slug,
      teamTimezone: teams.timezone,
      restringirFueraHorario: teams.restringirFueraHorario,
    })
    .from(memberships)
    .innerJoin(teams, eq(memberships.teamId, teams.id))
    .where(and(eq(memberships.userId, user.id), eq(memberships.active, true)));

  if (membresias.length === 0) {
    if (!user.isPlatformAdmin) {
      return NextResponse.json({ error: "sin_acceso" }, { status: 403 });
    }

    const { token, maxAgeSeconds } = await createSession({
      userId: user.id,
      userAgent: req.headers.get("user-agent"),
      ip: ipReq(req),
    });
    const store = await cookies();
    store.set(SESSION_COOKIE, token, sessionCookieBase(maxAgeSeconds));

    return NextResponse.json({
      ok: true,
      redirect: user.mustChangePassword ? "/primer-acceso" : "/admin",
    });
  }

  const memb =
    (body.teamSlug && membresias.find((m) => m.teamSlug === body.teamSlug)) ||
    membresias[0]!;

  if (memb.restringirFueraHorario && memb.role !== "owner") {
    const turnos = await db
      .select({
        dayOfWeek: staffSchedules.dayOfWeek,
        horaIni: staffSchedules.horaIni,
        horaFin: staffSchedules.horaFin,
      })
      .from(staffSchedules)
      .where(eq(staffSchedules.membershipId, memb.membershipId));
    if (fueraDeTurno(memb.teamTimezone, turnos)) {
      return NextResponse.json({ error: "fuera_de_turno" }, { status: 403 });
    }
  }

  const { token, maxAgeSeconds } = await createSession({
    userId: user.id,
    tenantId: memb.teamId,
    membershipId: memb.membershipId,
    userAgent: req.headers.get("user-agent"),
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieBase(maxAgeSeconds));

  void logAudit({
    tenantId: memb.teamId,
    usuarioId: user.id,
    rol: memb.role,
    accion: "auth.login",
    entidad: "users",
    entidadId: user.id,
  });

  return NextResponse.json({
    ok: true,
    ...(user.mustChangePassword ? { redirect: "/primer-acceso" } : {}),
  });
}
