import { NextResponse } from "next/server";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { getDb, teams, patients, appointments, reminders } from "@clinicflow/db";
import { appBaseUrl } from "@/lib/mail";
import { plantillaRecall } from "@/lib/notify";
import { enviarRecordatorio, getNotificationSettings } from "@/lib/reminder-engine";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MESES_DORMIDO = 6;
const DIAS_DEDUPE = 60;

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
  const clinics = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug })
    .from(teams);

  const limiteDedupe = new Date(Date.now() - DIAS_DEDUPE * 24 * 3600_000);
  let enviados = 0;
  let omitidos = 0;

  for (const team of clinics) {
    const settings = await getNotificationSettings(team.id);
    if (!settings || !settings.recallAuto) continue;

    const filas = await db
      .select({
        id: patients.id,
        nombre: patients.nombre,
        email: patients.email,
        celular: patients.celular,
        pacienteCreado: patients.createdAt,
        ultimaVisita: sql<string>`max(${appointments.fecha})`,
      })
      .from(patients)
      .leftJoin(appointments, eq(patients.id, appointments.patientId))
      .where(eq(patients.tenantId, team.id))
      .groupBy(patients.id, patients.nombre, patients.email, patients.celular, patients.createdAt)
      .orderBy(asc(sql`max(${appointments.fecha})`));

    for (const p of filas) {
      const base = p.ultimaVisita
        ? new Date(`${p.ultimaVisita}T00:00:00`)
        : p.pacienteCreado
          ? new Date(p.pacienteCreado)
          : new Date();
      const meses = Math.floor(
        (Date.now() - base.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
      );
      if (meses < MESES_DORMIDO) continue;

      const [reciente] = await db
        .select({ id: reminders.id })
        .from(reminders)
        .where(
          and(
            eq(reminders.tenantId, team.id),
            eq(reminders.pacienteId, p.id),
            eq(reminders.tipo, "recall"),
            gte(reminders.createdAt, limiteDedupe),
          ),
        )
        .limit(1);
      if (reciente) {
        omitidos++;
        continue;
      }

      const plantilla = plantillaRecall({
        clinicaNombre: team.name,
        pacienteNombre: p.nombre,
        reservaUrl: `${appBaseUrl()}/${team.slug}/reserva`,
      });
      const r = await enviarRecordatorio({
        tenantId: team.id,
        tipo: "recall",
        pacienteId: p.id,
        citaId: null,
        destinatario: p.email,
        plantilla,
        celularPaciente: p.celular,
      }).catch(() => ({ ok: false, reminderId: "", error: "error_interno" }));

      if (r.ok) enviados++;
      else omitidos++;
    }

    void logAudit({
      tenantId: team.id,
      accion: "recall.auto",
      entidad: "reminders",
      payload: { enviados, omitidos },
    });
  }

  return NextResponse.json({ ok: true, enviados, omitidos });
}
