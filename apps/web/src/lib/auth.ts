import { cache } from "react";
import { cookies } from "next/headers";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, ne } from "drizzle-orm";
import {
  getDb,
  sessions,
  users,
  memberships,
  teams,
} from "@clinicflow/db";
import { hasPermission, type Permission, type StaffRole } from "@clinicflow/core";

export const SESSION_COOKIE = "of_session";
export const ADMIN_RETURN_COOKIE = "of_admin_return";
const SESSION_DAYS = 30;
const SESSION_HOURS_IMPERSONATED = 8;
const EXTEND_WHEN_LESS_THAN_MS = 7 * 24 * 3600_000;

export const ROLE_INFO: Record<StaffRole, { label: string }> = {
  owner: { label: "Dueño/a" },
  receptionist: { label: "Recepción" },
  assistant: { label: "Asistente" },
  doctor: { label: "Odontólogo/a" },
};

export interface SessionUser {
  userId: string;
  name: string;
  email: string;
  teamId: string;
  teamName: string;
  teamSlug: string;
  teamTimezone: string;
  membershipId: string;
  role: StaffRole;
  isPlatformAdmin: boolean;
  mustChangePassword: boolean;
  impersonatedByUserId: string | null;
  sessionToken: string;
  sessionExpiresAt: Date;
}

export interface PlatformSessionUser {
  userId: string;
  name: string;
  email: string;
  isPlatformAdmin: true;
  mustChangePassword: boolean;
  sessionToken: string;
  sessionExpiresAt: Date;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, key) => {
      if (err) return reject(err);
      resolve(`scrypt:${salt}:${Buffer.from(key).toString("hex")}`);
    });
  });
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  return new Promise((resolve) => {
    const parts = stored.split(":");
    if (parts.length !== 3 || parts[0] !== "scrypt") return resolve(false);
    const salt = parts[1];
    const expected = parts[2];
    if (!salt || !expected) return resolve(false);
    scrypt(password, salt, 64, (err, key) => {
      if (err) return resolve(false);
      const buf = Buffer.from(expected, "hex");
      const candidate = Buffer.from(key);
      resolve(buf.length === candidate.length && timingSafeEqual(buf, candidate));
    });
  });
}

export async function createSession(opts: {
  userId: string;
  tenantId?: string | null;
  membershipId?: string | null;
  impersonatedByUserId?: string | null;
  maxAgeSeconds?: number;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<{ token: string; expiresAt: Date; maxAgeSeconds: number }> {
  const token = randomToken();
  const maxAgeSeconds = opts.maxAgeSeconds ?? SESSION_DAYS * 24 * 3600;
  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);
  await getDb().insert(sessions).values({
    sessionToken: token,
    userId: opts.userId,
    tenantId: opts.tenantId ?? null,
    membershipId: opts.membershipId ?? null,
    impersonatedByUserId: opts.impersonatedByUserId ?? null,
    expiresAt,
    userAgent: opts.userAgent ?? null,
    ip: opts.ip ?? null,
  });
  return { token, expiresAt, maxAgeSeconds };
}

export async function destroySession(token: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.sessionToken, token));
}

export async function destroyAllSessions(userId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}

export async function destroyOtherSessions(userId: string, exceptToken: string): Promise<void> {
  await getDb()
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.sessionToken, exceptToken)));
}

export function sessionCookieBase(maxAgeSeconds?: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds ?? SESSION_DAYS * 24 * 3600,
  };
}

export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 3600;
export const IMPERSONATED_MAX_AGE_SECONDS = SESSION_HOURS_IMPERSONATED * 3600;

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await getDb()
    .select({
      sessionToken: sessions.sessionToken,
      sessionExpiresAt: sessions.expiresAt,
      impersonatedByUserId: sessions.impersonatedByUserId,
      userId: users.id,
      name: users.name,
      email: users.email,
      lockedAt: users.lockedAt,
      isPlatformAdmin: users.isPlatformAdmin,
      mustChangePassword: users.mustChangePassword,
      teamId: teams.id,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamTimezone: teams.timezone,
      membershipId: memberships.id,
      role: memberships.role,
      active: memberships.active,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .leftJoin(memberships, eq(sessions.membershipId, memberships.id))
    .leftJoin(teams, eq(sessions.tenantId, teams.id))
    .where(and(eq(sessions.sessionToken, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (row.lockedAt) {
    await destroySession(token);
    return null;
  }

  if (
    !row.teamId ||
    !row.teamName ||
    !row.teamSlug ||
    !row.teamTimezone ||
    !row.membershipId ||
    !row.role ||
    !row.active
  ) {
    return null;
  }

  if (
    row.sessionExpiresAt.getTime() - Date.now() < EXTEND_WHEN_LESS_THAN_MS &&
    !row.mustChangePassword
  ) {
    const nueva = new Date(Date.now() + SESSION_DAYS * 24 * 3600_000);
    await getDb()
      .update(sessions)
      .set({ expiresAt: nueva })
      .where(eq(sessions.sessionToken, token));
    row.sessionExpiresAt = nueva;
  }

  return {
    userId: row.userId,
    name: row.name,
    email: row.email,
    teamId: row.teamId,
    teamName: row.teamName,
    teamSlug: row.teamSlug,
    teamTimezone: row.teamTimezone,
    membershipId: row.membershipId,
    role: row.role as StaffRole,
    isPlatformAdmin: row.isPlatformAdmin,
    mustChangePassword: row.mustChangePassword,
    impersonatedByUserId: row.impersonatedByUserId,
    sessionToken: row.sessionToken,
    sessionExpiresAt: row.sessionExpiresAt,
  };
});

export const getPlatformSession = cache(async (): Promise<PlatformSessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await getDb()
    .select({
      sessionToken: sessions.sessionToken,
      sessionExpiresAt: sessions.expiresAt,
      tenantId: sessions.tenantId,
      membershipId: sessions.membershipId,
      userId: users.id,
      name: users.name,
      email: users.email,
      lockedAt: users.lockedAt,
      isPlatformAdmin: users.isPlatformAdmin,
      mustChangePassword: users.mustChangePassword,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.sessionToken, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (row.lockedAt || !row.isPlatformAdmin) return null;
  if (row.tenantId || row.membershipId) return null;

  return {
    userId: row.userId,
    name: row.name,
    email: row.email,
    isPlatformAdmin: true,
    mustChangePassword: row.mustChangePassword,
    sessionToken: row.sessionToken,
    sessionExpiresAt: row.sessionExpiresAt,
  };
});

export type GuardOk = {
  ok: true;
  user: { id: string; name: string; email: string };
  team: { id: string; name: string; slug: string; timezone: string };
  membership: { id: string; role: StaffRole };
};
export type GuardErr = { ok: false; status: 401 | 403 };

export async function guardStaff(permission?: Permission): Promise<GuardOk | GuardErr> {
  const s = await getSession();
  if (!s) return { ok: false, status: 401 };
  if (permission && !hasPermission(s.role, permission)) return { ok: false, status: 403 };
  return {
    ok: true,
    user: { id: s.userId, name: s.name, email: s.email },
    team: { id: s.teamId, name: s.teamName, slug: s.teamSlug, timezone: s.teamTimezone },
    membership: { id: s.membershipId, role: s.role },
  };
}

export function guardError(g: GuardErr) {
  return g.status === 401 ? "sin_sesion" : "sin_permiso";
}

export async function hoyTenant(timezone: string): Promise<string> {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}
