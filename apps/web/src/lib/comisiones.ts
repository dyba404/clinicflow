import { and, eq } from "drizzle-orm";
import {
  getDb,
  payments,
  appointments,
  commissionSettings,
  commissionEntries,
  teams,
} from "@clinicflow/db";

export type ComisionResultado =
  | { calculada: true; monto: number; periodo: string }
  | { calculada: false; omitido: "pago_inexistente" | "sin_cita" | "sin_porcentaje" | "duplicado" };

export async function calcularComisionPorPago(
  paymentId: string,
  timezone?: string,
): Promise<ComisionResultado> {
  const db = getDb();

  const [pago] = await db
    .select({
      id: payments.id,
      appointmentId: payments.appointmentId,
      monto: payments.monto,
      createdAt: payments.createdAt,
      tenantId: payments.tenantId,
    })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);
  if (!pago) return { calculada: false, omitido: "pago_inexistente" };

  let zona = timezone;
  if (!zona) {
    const [team] = await db
      .select({ timezone: teams.timezone })
      .from(teams)
      .where(eq(teams.id, pago.tenantId))
      .limit(1);
    zona = team?.timezone ?? "America/Lima";
  }

  if (!pago.appointmentId) return { calculada: false, omitido: "sin_cita" };

  const [cita] = await db
    .select({ id: appointments.id, doctorId: appointments.doctorId })
    .from(appointments)
    .where(eq(appointments.id, pago.appointmentId))
    .limit(1);
  if (!cita || !cita.doctorId) return { calculada: false, omitido: "sin_cita" };

  const [cfg] = await db
    .select({ porcentaje: commissionSettings.porcentaje })
    .from(commissionSettings)
    .where(eq(commissionSettings.membershipId, cita.doctorId))
    .limit(1);
  const porcentaje = cfg ? Number(cfg.porcentaje) : 0;
  if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
    return { calculada: false, omitido: "sin_porcentaje" };
  }

  const base = Number(pago.monto);
  const monto = Math.round((base * porcentaje) / 100 * 100) / 100;
  const periodo = new Intl.DateTimeFormat("en-CA", { timeZone: zona })
    .format(pago.createdAt)
    .slice(0, 7);

  const [existente] = await db
    .select({ id: commissionEntries.id })
    .from(commissionEntries)
    .where(
      and(
        eq(commissionEntries.paymentId, pago.id),
        eq(commissionEntries.doctorMembershipId, cita.doctorId),
      ),
    )
    .limit(1);
  if (existente) return { calculada: false, omitido: "duplicado" };

  try {
    await db.insert(commissionEntries).values({
      tenantId: pago.tenantId,
      doctorMembershipId: cita.doctorId,
      paymentId: pago.id,
      appointmentId: cita.id,
      base: base.toFixed(2),
      porcentaje: porcentaje.toFixed(2),
      monto: monto.toFixed(2),
      periodo,
    });
  } catch {
    return { calculada: false, omitido: "duplicado" };
  }

  return { calculada: true, monto, periodo };
}
