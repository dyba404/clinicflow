import { and, eq, gt, isNull } from "drizzle-orm";
import {
  getDb,
  patientMagicTokens,
  appointments,
  patients,
  services,
  teams,
} from "@clinicflow/db";
import { randomHex } from "@/lib/audit";
import { appBaseUrl } from "@/lib/mail";

const MAGIC_DAYS = 30;

export async function ensureMagicToken(
  tenantId: string,
  patientId: string,
  appointmentId: string | null,
): Promise<string> {
  const db = getDb();
  const rows = await db
    .select({ token: patientMagicTokens.token })
    .from(patientMagicTokens)
    .where(
      and(
        eq(patientMagicTokens.patientId, patientId),
        isNull(patientMagicTokens.revokedAt),
        gt(patientMagicTokens.expiresAt, new Date()),
        appointmentId ? eq(patientMagicTokens.appointmentId, appointmentId) : undefined,
      ),
    )
    .limit(1);
  if (rows[0]) return rows[0].token;

  const token = randomHex(24);
  await db.insert(patientMagicTokens).values({
    tenantId,
    patientId,
    appointmentId,
    token,
    expiresAt: new Date(Date.now() + MAGIC_DAYS * 24 * 3600_000),
  });
  return token;
}

export async function ensurePortalToken(tenantId: string, patientId: string): Promise<string> {
  const db = getDb();
  const rows = await db
    .select({ token: patientMagicTokens.token })
    .from(patientMagicTokens)
    .where(
      and(
        eq(patientMagicTokens.patientId, patientId),
        eq(patientMagicTokens.tenantId, tenantId),
        isNull(patientMagicTokens.revokedAt),
        isNull(patientMagicTokens.appointmentId),
        gt(patientMagicTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (rows[0]) return rows[0].token;

  const token = randomHex(24);
  await db.insert(patientMagicTokens).values({
    tenantId,
    patientId,
    appointmentId: null,
    token,
    expiresAt: new Date(Date.now() + MAGIC_DAYS * 24 * 3600_000),
  });
  return token;
}

export function magicUrl(slug: string, token: string): string {
  return `${appBaseUrl()}/${slug}/gestionar/${token}`;
}

export function portalUrl(slug: string, token: string): string {
  return `${appBaseUrl()}/${slug}/portal/${token}`;
}

export async function portalUrlFor(
  tenantId: string,
  patientId: string,
  slug: string,
): Promise<string> {
  const token = await ensurePortalToken(tenantId, patientId);
  return portalUrl(slug, token);
}

export function magicUrlFor(tenantId: string, patientId: string, appointmentId: string, slug: string) {
  return ensureMagicToken(tenantId, patientId, appointmentId).then((t) => magicUrl(slug, t));
}

export interface MagicContext {
  token: string;
  patient: typeof patients.$inferSelect;
  team: typeof teams.$inferSelect;
  appointment: typeof appointments.$inferSelect;
  service: { id: string; nombre: string; duracionMin: number; precio: string } | null;
}

export interface PortalContext {
  token: string;
  patient: typeof patients.$inferSelect;
  team: typeof teams.$inferSelect;
}

export type PortalResult = { ok: true; ctx: PortalContext } | { ok: false; reason: string };

export async function resolvePortalToken(token: string): Promise<PortalResult> {
  const db = getDb();
  const rows = await db
    .select()
    .from(patientMagicTokens)
    .where(eq(patientMagicTokens.token, token))
    .limit(1);
  const t = rows[0];
  if (!t) return { ok: false, reason: "token_invalido" };
  if (t.revokedAt) return { ok: false, reason: "token_invalido" };
  if (t.expiresAt < new Date()) return { ok: false, reason: "token_invalido" };
  if (t.appointmentId) return { ok: false, reason: "token_invalido" };

  const [pats, teamRows] = await Promise.all([
    db.select().from(patients).where(eq(patients.id, t.patientId)).limit(1),
    db.select().from(teams).where(eq(teams.id, t.tenantId)).limit(1),
  ]);
  const patient = pats[0];
  const team = teamRows[0];
  if (!patient || !team) return { ok: false, reason: "token_invalido" };

  return { ok: true, ctx: { token, patient, team } };
}

export async function resolveMagicToken(token: string): Promise<
  { ok: true; ctx: MagicContext } | { ok: false; reason: string }
> {
  const db = getDb();
  const rows = await db
    .select()
    .from(patientMagicTokens)
    .where(eq(patientMagicTokens.token, token))
    .limit(1);
  const t = rows[0];
  if (!t) return { ok: false, reason: "no_encontrado" };
  if (t.revokedAt) return { ok: false, reason: "revocado" };
  if (t.expiresAt < new Date()) return { ok: false, reason: "expirado" };
  if (!t.appointmentId) return { ok: false, reason: "sin_cita" };

  const [appts, pats, teamRows] = await Promise.all([
    db.select().from(appointments).where(eq(appointments.id, t.appointmentId)).limit(1),
    db.select().from(patients).where(eq(patients.id, t.patientId)).limit(1),
    db.select().from(teams).where(eq(teams.id, t.tenantId)).limit(1),
  ]);
  const appointment = appts[0];
  const patient = pats[0];
  const team = teamRows[0];
  if (!appointment || !patient || !team) return { ok: false, reason: "datos_incompletos" };

  const svcRows = await db
    .select({ id: services.id, nombre: services.nombre, duracionMin: services.duracionMin, precio: services.precio })
    .from(services)
    .where(eq(services.id, appointment.serviceId))
    .limit(1);

  return {
    ok: true,
    ctx: { token, patient, team, appointment, service: svcRows[0] ?? null },
  };
}
