import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, patients, waitlists } from "@clinicflow/db";
import { appBaseUrl } from "@/lib/mail";
import { logAudit } from "@/lib/audit";
import { plantillaWaitlistOferta } from "@/lib/notify";
import { enviarRecordatorio } from "@/lib/reminder-engine";

const MAXIMO_OFERTAS = 3;

export async function ofrecerHuecoAutomatico(opts: {
  tenantId: string;
  tenantNombre: string;
  tenantSlug: string;
  citaId: string;
  fecha: string;
  horaIni: string;
  via: string;
}): Promise<{ ofrecidas: number }> {
  const db = getDb();

  const filas = await db
    .select({
      id: waitlists.id,
      prioridad: waitlists.prioridad,
      preferencia: waitlists.preferencia,
      patientId: waitlists.patientId,
      pacienteNombre: patients.nombre,
      pacienteEmail: patients.email,
      pacienteCelular: patients.celular,
    })
    .from(waitlists)
    .innerJoin(patients, eq(waitlists.patientId, patients.id))
    .where(and(eq(waitlists.tenantId, opts.tenantId), eq(waitlists.estado, "activa")))
    .orderBy(desc(waitlists.prioridad), asc(waitlists.createdAt))
    .limit(MAXIMO_OFERTAS);

  if (filas.length === 0) return { ofrecidas: 0 };

  const reservaUrl = `${appBaseUrl()}/${opts.tenantSlug}/reserva`;
  let ofrecidas = 0;

  for (const fila of filas) {
    await db
      .update(waitlists)
      .set({ estado: "ofrecida", updatedAt: new Date() })
      .where(and(eq(waitlists.id, fila.id), eq(waitlists.estado, "activa")));

    const plantilla = plantillaWaitlistOferta({
      clinicaNombre: opts.tenantNombre,
      clinicaSlug: opts.tenantSlug,
      pacienteNombre: fila.pacienteNombre,
      preferencia: fila.preferencia,
      fecha: opts.fecha,
      horaIni: opts.horaIni,
      reservaUrl,
    });

    await enviarRecordatorio({
      tenantId: opts.tenantId,
      tipo: "waitlist",
      pacienteId: fila.patientId,
      citaId: opts.citaId,
      destinatario: fila.pacienteEmail,
      plantilla,
      celularPaciente: fila.pacienteCelular,
    }).catch(() => {});
    ofrecidas += 1;
  }

  void logAudit({
    tenantId: opts.tenantId,
    accion: "waitlist.ofrecer_auto",
    entidad: "citas",
    entidadId: opts.citaId,
    payload: {
      via: opts.via,
      fecha: opts.fecha,
      horaIni: opts.horaIni,
      ofrecidas,
    },
  });

  return { ofrecidas };
}
