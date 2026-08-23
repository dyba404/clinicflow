import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb, appointments, memberships, teams } from "@clinicflow/db";

const OCCUPYING = ["solicitada", "confirmada", "en_espera", "en_atencion"] as const;

// OLA 6 (6.8): round-robin. Elige al doctor activo con menos citas ocupantes
// en la fecha indicada; en empate, el de menos citas totales en el rango
// cercano. Devuelve null si no hay doctores activos.
export async function elegirDoctorRoundRobin(opts: {
  tenantId: string;
  fecha: string;
}): Promise<string | null> {
  const db = getDb();

  const doctores = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.teamId, opts.tenantId),
        eq(memberships.role, "doctor"),
        eq(memberships.active, true),
      ),
    )
    .orderBy(asc(memberships.createdAt));
  if (doctores.length === 0) return null;
  const ids = doctores.map((d) => d.id);

  const conteoDia = await db
    .select({
      doctorId: appointments.doctorId,
      n: sql<number>`count(*)::int`,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, opts.tenantId),
        eq(appointments.fecha, opts.fecha),
        inArray(appointments.doctorId, ids),
        inArray(appointments.estado, [...OCCUPYING]),
      ),
    )
    .groupBy(appointments.doctorId);
  const porDia = new Map(conteoDia.map((c) => [c.doctorId, c.n]));

  let mejor: string | null = null;
  let mejorN = Number.POSITIVE_INFINITY;
  for (const id of ids) {
    const n = porDia.get(id) ?? 0;
    if (n < mejorN) {
      mejorN = n;
      mejor = id;
    }
  }
  return mejor;
}

export async function roundRobinActivo(tenantId: string): Promise<boolean> {
  const [team] = await getDb()
    .select({ roundRobin: teams.roundRobin })
    .from(teams)
    .where(eq(teams.id, tenantId))
    .limit(1);
  return team?.roundRobin ?? false;
}
