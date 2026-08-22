import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, patients, appointments, services } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { appBaseUrl, mailConfigurado } from "@/lib/mail";
import { plantillaRecall, plantillaRecordatorio24h } from "@/lib/notify";
import { enviarRecordatorio, getNotificationSettings } from "@/lib/reminder-engine";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guardStaff("reminders.send");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  if (!mailConfigurado()) {
    return NextResponse.json({ error: "email_no_configurado" }, { status: 400 });
  }

  let body: { pacienteIds?: string[]; tipo?: "recall" | "recordatorio_24h" };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const tipo = body.tipo ?? "recall";
  const ids = body.pacienteIds;
  if (tipo === "recall" && (!Array.isArray(ids) || ids.length === 0)) {
    return NextResponse.json({ error: "pacientes_requeridos" }, { status: 400 });
  }

  const db = getDb();
  const settings = await getNotificationSettings(g.team.id);
  if (tipo === "recordatorio_24h" && settings && !settings.recordatorio24h) {
    return NextResponse.json({ error: "recordatorios_desactivados" }, { status: 400 });
  }

  const resultados: Array<{ pacienteId: string; ok: boolean; error?: string }> = [];

  if (tipo === "recall") {
    const rows = await db
      .select({
        id: patients.id,
        nombre: patients.nombre,
        email: patients.email,
        celular: patients.celular,
      })
      .from(patients)
      .where(and(eq(patients.tenantId, g.team.id), inArray(patients.id, ids!)))
      .orderBy(asc(patients.nombre));

    for (const p of rows) {
      const plantilla = plantillaRecall({
        clinicaNombre: g.team.name,
        pacienteNombre: p.nombre,
        reservaUrl: `${appBaseUrl()}/${g.team.slug}/reserva`,
      });
      const r = await enviarRecordatorio({
        tenantId: g.team.id,
        tipo: "recall",
        pacienteId: p.id,
        citaId: null,
        destinatario: p.email,
        plantilla,
        enviadoPor: g.user.id,
        celularPaciente: p.celular,
      });
      resultados.push({ pacienteId: p.id, ok: r.ok, error: r.error });
    }
  } else {
    const manana = new Intl.DateTimeFormat("en-CA", { timeZone: g.team.timezone }).format(
      new Date(Date.now() + 86_400_000),
    );
    const citas = await db
      .select({
        id: appointments.id,
        fecha: appointments.fecha,
        horaIni: appointments.horaIni,
        patientId: appointments.patientId,
        patientNombre: patients.nombre,
        patientEmail: patients.email,
        patientCelular: patients.celular,
        servicioNombre: services.nombre,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .where(
        and(
          eq(appointments.tenantId, g.team.id),
          eq(appointments.fecha, manana),
          eq(appointments.estado, "confirmada"),
        ),
      );

    for (const c of citas) {
      const plantilla = plantillaRecordatorio24h({
        cita: {
          fecha: c.fecha,
          horaIni: c.horaIni,
          servicio: c.servicioNombre,
          clinicaNombre: g.team.name,
          clinicaSlug: g.team.slug,
        },
      });
      const r = await enviarRecordatorio({
        tenantId: g.team.id,
        tipo: "recordatorio_24h",
        pacienteId: c.patientId,
        citaId: c.id,
        destinatario: c.patientEmail,
        plantilla,
        enviadoPor: g.user.id,
        celularPaciente: c.patientCelular,
      });
      resultados.push({ pacienteId: c.patientId, ok: r.ok, error: r.error });
    }
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: tipo === "recall" ? "recall.enviar" : "recordatorio_24h.enviar",
    entidad: "reminders",
    payload: { enviadas: resultados.filter((r) => r.ok).length, total: resultados.length },
  });

  return NextResponse.json({
    ok: true,
    enviados: resultados.filter((r) => r.ok).length,
    total: resultados.length,
    errores: resultados.filter((r) => !r.ok).map((r) => ({ pacienteId: r.pacienteId, error: r.error })),
  });
}
