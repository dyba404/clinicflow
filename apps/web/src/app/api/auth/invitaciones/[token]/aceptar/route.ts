import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import {
  getDb,
  invitations,
  users,
  memberships,
  teams,
  subscriptions,
  notificationSettings,
} from "@clinicflow/db";
import { hashPassword, verifyPassword, createSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let body: { nombre?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const password = body.password ?? "";
  if (password.length < 8) {
    return NextResponse.json({ error: "password_corta" }, { status: 400 });
  }

  const db = getDb();
  const [inv] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1);
  if (!inv) {
    return NextResponse.json({ error: "invitacion_no_encontrada" }, { status: 404 });
  }
  if (inv.expiresAt < new Date()) {
    return NextResponse.json({ error: "invitacion_expirada" }, { status: 410 });
  }

  const [team] = await db.select().from(teams).where(eq(teams.id, inv.teamId)).limit(1);
  if (!team) {
    return NextResponse.json({ error: "clinica_inexistente" }, { status: 404 });
  }

  let userId: string;
  const [existing] = await db.select().from(users).where(eq(users.email, inv.email)).limit(1);
  if (existing) {
    if (existing.passwordHash && !(await verifyPassword(password, existing.passwordHash))) {
      return NextResponse.json({ error: "password_no_coincide" }, { status: 409 });
    }
    if (!existing.passwordHash) {
      const hash = await hashPassword(password);
      await db
        .update(users)
        .set({
          passwordHash: hash,
          name: body.nombre?.trim() || existing.name,
          emailVerifiedAt: new Date(),
        })
        .where(eq(users.id, existing.id));
    }
    userId = existing.id;
  } else {
    const nombre = body.nombre?.trim();
    if (!nombre || nombre.length < 3) {
      return NextResponse.json({ error: "nombre_invalido" }, { status: 400 });
    }
    const hash = await hashPassword(password);
    const [nuevo] = await db
      .insert(users)
      .values({ name: nombre, email: inv.email, passwordHash: hash, emailVerifiedAt: new Date() })
      .returning();
    if (!nuevo) {
      return NextResponse.json({ error: "no_se_pudo_crear_usuario" }, { status: 500 });
    }
    userId = nuevo.id;
  }

  const [membExistente] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.teamId, team.id), eq(memberships.userId, userId)))
    .limit(1);

  let membershipId: string;
  if (membExistente) {
    membershipId = membExistente.id;
    await db
      .update(memberships)
      .set({ active: true, updatedAt: new Date() })
      .where(eq(memberships.id, membershipId));
  } else {
    const [m] = await db
      .insert(memberships)
      .values({ teamId: team.id, userId, role: inv.role })
      .returning();
    membershipId = m!.id;
  }

  await db.delete(invitations).where(eq(invitations.id, inv.id));

  const [sub] = await db
    .select({ tenantId: subscriptions.tenantId })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, team.id))
    .limit(1);
  if (!sub) {
    await db.insert(subscriptions).values({ tenantId: team.id, plan: "free", estado: "activo" });
  }
  const [notif] = await db
    .select({ tenantId: notificationSettings.tenantId })
    .from(notificationSettings)
    .where(eq(notificationSettings.tenantId, team.id))
    .limit(1);
  if (!notif) {
    await db.insert(notificationSettings).values({ tenantId: team.id });
  }

  const { token: sessionToken } = await createSession({
    userId,
    tenantId: team.id,
    membershipId,
    userAgent: req.headers.get("user-agent"),
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  void logAudit({
    tenantId: team.id,
    usuarioId: userId,
    rol: inv.role,
    accion: "invitacion.aceptar",
    entidad: "memberships",
    entidadId: membershipId,
  });

  return NextResponse.json({ ok: true });
}
