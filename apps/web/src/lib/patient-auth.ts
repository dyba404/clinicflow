import { cache } from "react";
import { cookies } from "next/headers";
import { randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import {
  getDb,
  patientSessions,
  patients,
  patientOtpCodes,
  teams,
} from "@clinicflow/db";
import { hashPassword, verifyPassword, randomToken } from "@/lib/auth";
import { hashHmac } from "@/lib/crypto";

export const PATIENT_SESSION_COOKIE = "cf_patient_session";
const PATIENT_SESSION_DAYS = 30;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 3;

export interface PatientSessionUser {
  patientId: string;
  tenantId: string;
  nombre: string;
  celular: string;
  email: string | null;
  teamName: string;
  teamSlug: string;
  sessionToken: string;
}

export async function createPatientSession(opts: {
  patientId: string;
  tenantId: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<{ token: string; maxAgeSeconds: number }> {
  const token = randomToken();
  const maxAgeSeconds = PATIENT_SESSION_DAYS * 24 * 3600;
  await getDb().insert(patientSessions).values({
    sessionToken: token,
    patientId: opts.patientId,
    tenantId: opts.tenantId,
    expiresAt: new Date(Date.now() + maxAgeSeconds * 1000),
    userAgent: opts.userAgent ?? null,
    ip: opts.ip ?? null,
  });
  return { token, maxAgeSeconds };
}

export async function destroyPatientSession(token: string): Promise<void> {
  await getDb().delete(patientSessions).where(eq(patientSessions.sessionToken, token));
}

export async function destroyAllPatientSessions(patientId: string): Promise<void> {
  await getDb().delete(patientSessions).where(eq(patientSessions.patientId, patientId));
}

export const getPatientSession = cache(async (): Promise<PatientSessionUser | null> => {
  const store = await cookies();
  const token = store.get(PATIENT_SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await getDb()
    .select({
      sessionToken: patientSessions.sessionToken,
      patientId: patients.id,
      tenantId: patients.tenantId,
      nombre: patients.nombre,
      celular: patients.celular,
      email: patients.email,
      teamName: teams.name,
      teamSlug: teams.slug,
    })
    .from(patientSessions)
    .innerJoin(patients, eq(patientSessions.patientId, patients.id))
    .innerJoin(teams, eq(patients.tenantId, teams.id))
    .where(and(eq(patientSessions.sessionToken, token), gt(patientSessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    patientId: row.patientId,
    tenantId: row.tenantId,
    nombre: row.nombre,
    celular: row.celular,
    email: row.email,
    teamName: row.teamName,
    teamSlug: row.teamSlug,
    sessionToken: row.sessionToken,
  };
});

export function patientSessionCookieBase(maxAgeSeconds?: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds ?? PATIENT_SESSION_DAYS * 24 * 3600,
  };
}

export function validarPasswordPaciente(password: string, paciente: { documento?: string | null; celular?: string | null }): string | null {
  if (password.length < 8) return "password_corta";
  if (password.length > 128) return "password_larga";
  const lower = password.toLowerCase();
  if (paciente.documento && lower.includes(paciente.documento.toLowerCase())) return "password_obvia";
  if (paciente.celular && lower.includes(paciente.celular.replace(/\D/g, ""))) return "password_obvia";
  if (/^(12345678|password|contrasena|qwertyui)/i.test(password)) return "password_obvia";
  return null;
}

export async function loginPaciente(opts: {
  tenantId: string;
  identificador: string;
  password: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<{ ok: true; patientId: string } | { ok: false; error: string }> {
  const db = getDb();
  const id = opts.identificador.trim();

  const [paciente] = await db
    .select()
    .from(patients)
    .where(
      and(
        eq(patients.tenantId, opts.tenantId),
        eq(patients.celular, id.replace(/\s+/g, "")),
      ),
    )
    .limit(1);

  if (!paciente || !paciente.passwordHash) {
    return { ok: false, error: "credenciales_invalidas" };
  }

  if (paciente.lockedUntil && paciente.lockedUntil > new Date()) {
    return { ok: false, error: "cuenta_bloqueada" };
  }

  const valido = await verifyPassword(opts.password, paciente.passwordHash);
  if (!valido) {
    const intentos = (paciente.failedAttempts ?? 0) + 1;
    const bloquear = intentos >= MAX_FAILED_ATTEMPTS;
    await db
      .update(patients)
      .set({
        failedAttempts: intentos,
        lockedUntil: bloquear ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      })
      .where(eq(patients.id, paciente.id));
    return { ok: false, error: bloquear ? "cuenta_bloqueada" : "credenciales_invalidas" };
  }

  await db
    .update(patients)
    .set({ failedAttempts: 0, lockedUntil: null })
    .where(eq(patients.id, paciente.id));

  return { ok: true, patientId: paciente.id };
}

export async function generarOtp(patientId: string, purpose: string): Promise<string> {
  const db = getDb();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = hashHmac(`${patientId}:${purpose}:${code}`);
  await db.insert(patientOtpCodes).values({
    patientId,
    purpose,
    codeHash,
    expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
  });
  return code;
}

export async function verificarOtp(
  patientId: string,
  purpose: string,
  code: string,
): Promise<{ ok: true; otpId: string } | { ok: false; error: string }> {
  const db = getDb();
  const rows = await db
    .select()
    .from(patientOtpCodes)
    .where(
      and(
        eq(patientOtpCodes.patientId, patientId),
        eq(patientOtpCodes.purpose, purpose),
        isNull(patientOtpCodes.usedAt),
        gt(patientOtpCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(patientOtpCodes.createdAt))
    .limit(1);

  const otp = rows[0];
  if (!otp) return { ok: false, error: "otp_invalido" };

  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "otp_intentos_agotados" };
  }

  const esperado = hashHmac(`${patientId}:${purpose}:${code.trim()}`);
  if (esperado !== otp.codeHash) {
    await db
      .update(patientOtpCodes)
      .set({ attempts: otp.attempts + 1 })
      .where(eq(patientOtpCodes.id, otp.id));
    return { ok: false, error: "otp_invalido" };
  }

  await db
    .update(patientOtpCodes)
    .set({ usedAt: new Date() })
    .where(eq(patientOtpCodes.id, otp.id));

  return { ok: true, otpId: otp.id };
}

export { hashPassword };
