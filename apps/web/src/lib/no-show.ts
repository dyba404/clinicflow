import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb, appointmentStatusEvents, patients } from "@clinicflow/db";
import { appBaseUrl } from "@/lib/mail";
import { logAudit } from "@/lib/audit";
import { plantillaNoShowRecuperacion } from "@/lib/notify";
import { enviarRecordatorio, getNotificationSettings } from "@/lib/reminder-engine";

export async function recuperacionNoShow(opts: {
  tenantId: string;
  tenantNombre: string;
  tenantSlug: string;
  citaId: string;
  patientId: string;
  enviadoPor: string | null;
}): Promise<{ enviado: boolean; omitido?: string }> {
  const settings = await getNotificationSettings(opts.tenantId);
  if (settings && !settings.noShowRecovery) {
    return { enviado: false, omitido: "recuperacion_desactivada" };
  }

  const db = getDb();
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, opts.patientId))
    .limit(1);
  if (!patient) return { enviado: false, omitido: "paciente_no_encontrado" };

  const plantilla = plantillaNoShowRecuperacion({
    clinicaNombre: opts.tenantNombre,
    pacienteNombre: patient.nombre,
    reservaUrl: `${appBaseUrl()}/${opts.tenantSlug}/reserva`,
  });

  const r = await enviarRecordatorio({
    tenantId: opts.tenantId,
    tipo: "recall",
    pacienteId: opts.patientId,
    citaId: opts.citaId,
    destinatario: patient.email,
    plantilla,
    enviadoPor: opts.enviadoPor,
    celularPaciente: patient.celular,
  }).catch(() => ({ ok: false, reminderId: "", error: "error_notificacion" }));

  void logAudit({
    tenantId: opts.tenantId,
    accion: "no_show.recuperacion",
    entidad: "citas",
    entidadId: opts.citaId,
    payload: { enviado: r.ok, motivo: r.ok ? null : (r.error ?? "error_notificacion") },
  });

  return r.ok ? { enviado: true } : { enviado: false, omitido: r.error };
}

export async function metricaRecuperacionNoShow(
  teamId: string,
  desde: string,
  hasta: string,
): Promise<{ noShows: number; recuperadas: number; tasa: number }> {
  const db = getDb();
  const inicio = new Date(`${desde}T00:00:00`);
  const fin = new Date(`${hasta}T23:59:59`);

  const eventosNoShow = await db
    .select({ citaId: appointmentStatusEvents.appointmentId })
    .from(appointmentStatusEvents)
    .where(
      and(
        eq(appointmentStatusEvents.tenantId, teamId),
        eq(appointmentStatusEvents.estadoTo, "no_show"),
        gte(appointmentStatusEvents.createdAt, inicio),
        lte(appointmentStatusEvents.createdAt, fin),
      ),
    );
  const citasNoShow = new Set(eventosNoShow.map((e) => e.citaId));
  if (citasNoShow.size === 0) return { noShows: 0, recuperadas: 0, tasa: 0 };

  const reAgendadas = await db
    .select({ citaId: appointmentStatusEvents.appointmentId })
    .from(appointmentStatusEvents)
    .where(
      and(
        eq(appointmentStatusEvents.tenantId, teamId),
        eq(appointmentStatusEvents.estadoFrom, "no_show"),
        inArray(appointmentStatusEvents.estadoTo, ["solicitada", "confirmada"]),
        inArray(appointmentStatusEvents.appointmentId, [...citasNoShow]),
      ),
    );
  const recuperadas = new Set(reAgendadas.map((e) => e.citaId)).size;
  const tasa = Math.round((recuperadas / citasNoShow.size) * 100);
  return { noShows: citasNoShow.size, recuperadas, tasa };
}
