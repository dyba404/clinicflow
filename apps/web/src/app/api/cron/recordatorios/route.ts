import { NextResponse } from "next/server";
import { and, asc, eq, gte, isNull, notLike, or } from "drizzle-orm";
import {
  getDb,
  teams,
  appointments,
  patients,
  services,
  reminders,
} from "@clinicflow/db";
import { plantillaRecordatorio24h, fechaLargaEs } from "@/lib/notify";
import { enviarRecordatorio, getNotificationSettings } from "@/lib/reminder-engine";

export const dynamic = "force-dynamic";

function mananaTenant(timezone: string): string {
  const manana = new Date(Date.now() + 24 * 3600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(manana);
}

function bearerValido(req: Request): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${esperado}`;
}

export async function POST(req: Request) {
  if (!bearerValido(req)) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  const db = getDb();
  const clinics = await db.select({
    id: teams.id,
    name: teams.name,
    slug: teams.slug,
    timezone: teams.timezone,
  }).from(teams);

  let enviados = 0;
  let omitidos = 0;
  let reintentos = 0;

  for (const team of clinics) {
    const settings = await getNotificationSettings(team.id);
    if (settings && !settings.recordatorio24h) continue;

    const fecha = mananaTenant(team.timezone);
    const citas = await db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        horaIni: appointments.horaIni,
        pacienteNombre: patients.nombre,
        pacienteEmail: patients.email,
        pacienteCelular: patients.celular,
        servicio: services.nombre,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .where(
        and(
          eq(appointments.tenantId, team.id),
          eq(appointments.fecha, fecha),
          eq(appointments.estado, "confirmada"),
        ),
      )
      .orderBy(asc(appointments.horaIni));

    for (const cita of citas) {
      if (!cita.pacienteEmail && !cita.pacienteCelular) {
        omitidos++;
        continue;
      }
      const [ya] = await db
        .select({ id: reminders.id })
        .from(reminders)
        .where(
          and(
            eq(reminders.citaId, cita.id),
            eq(reminders.tipo, "recordatorio_24h"),
          ),
        )
        .limit(1);
      if (ya) {
        omitidos++;
        continue;
      }
      const plantilla = plantillaRecordatorio24h({
        cita: {
          fecha,
          horaIni: cita.horaIni,
          servicio: cita.servicio,
          clinicaNombre: team.name,
          clinicaSlug: team.slug,
        },
      });
      const r = await enviarRecordatorio({
        tenantId: team.id,
        tipo: "recordatorio_24h",
        pacienteId: cita.patientId,
        citaId: cita.id,
        destinatario: cita.pacienteEmail,
        plantilla,
        celularPaciente: cita.pacienteCelular,
        waPlantilla: {
          nombre: settings?.plantillaRecordatorio ?? "recordatorio_cita",
          idioma: settings?.idiomaPlantilla ?? "es",
          parametros: [cita.pacienteNombre, fechaLargaEs(fecha), cita.horaIni, team.name],
        },
      });
      if (r.ok) enviados++;
      else omitidos++;
    }
  }

  const desde = new Date(Date.now() - 48 * 3600_000);
  for (const team of clinics) {
    const fallidos = await db
      .select({
        id: reminders.id,
        citaId: reminders.citaId,
      })
      .from(reminders)
      .where(
        and(
          eq(reminders.tenantId, team.id),
          eq(reminders.tipo, "recordatorio_24h"),
          eq(reminders.estado, "error"),
          or(isNull(reminders.error), notLike(reminders.error, "%reintento%")),
          gte(reminders.createdAt, desde),
        ),
      );

    for (const falla of fallidos) {
      if (!falla.citaId) continue;
      const [cita] = await db
        .select({
          id: appointments.id,
          patientId: appointments.patientId,
          fecha: appointments.fecha,
          horaIni: appointments.horaIni,
          pacienteNombre: patients.nombre,
          pacienteEmail: patients.email,
          pacienteCelular: patients.celular,
          servicio: services.nombre,
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(services, eq(appointments.serviceId, services.id))
        .where(
          and(
            eq(appointments.id, falla.citaId),
            eq(appointments.tenantId, team.id),
          ),
        )
        .limit(1);
      if (!cita) continue;

      const settings = await getNotificationSettings(team.id);
      const plantilla = plantillaRecordatorio24h({
        cita: {
          fecha: cita.fecha,
          horaIni: cita.horaIni,
          servicio: cita.servicio,
          clinicaNombre: team.name,
          clinicaSlug: team.slug,
        },
      });
      const r = await enviarRecordatorio({
        tenantId: team.id,
        tipo: "recordatorio_24h",
        pacienteId: cita.patientId,
        citaId: cita.id,
        destinatario: cita.pacienteEmail,
        plantilla,
        celularPaciente: cita.pacienteCelular,
        waPlantilla: {
          nombre: settings?.plantillaRecordatorio ?? "recordatorio_cita",
          idioma: settings?.idiomaPlantilla ?? "es",
          parametros: [cita.pacienteNombre, fechaLargaEs(cita.fecha), cita.horaIni, team.name],
        },
        reminderIdActualizar: falla.id,
      });
      if (r.ok) reintentos++;
      else {
        await db
          .update(reminders)
          .set({ error: `${r.error ?? "error_desconocido"} | reintento fallido` })
          .where(eq(reminders.id, falla.id));
      }
    }
  }

  return NextResponse.json({ ok: true, enviados, omitidos, reintentos });
}
