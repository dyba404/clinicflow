import { eq } from "drizzle-orm";
import { getDb, patients, teams } from "@clinicflow/db";
import { resolvePortalToken, type PortalResult } from "@/lib/magic-link";
import { getPatientSession } from "@/lib/patient-auth";

export async function resolvePortalAccess(token: string): Promise<PortalResult> {
  if (token === "mio") {
    const s = await getPatientSession();
    if (!s) return { ok: false, reason: "sin_sesion" };

    const db = getDb();
    const [patient] = await db.select().from(patients).where(eq(patients.id, s.patientId)).limit(1);
    const [team] = await db.select().from(teams).where(eq(teams.id, s.tenantId)).limit(1);
    if (!patient || !team) return { ok: false, reason: "sin_sesion" };

    return { ok: true, ctx: { token, patient, team } };
  }
  return resolvePortalToken(token);
}
