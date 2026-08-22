import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb, patients, reviewRequests, teams } from "@clinicflow/db";
import { mailConfigurado, sendMail } from "@/lib/mail";
import { getNotificationSettings } from "@/lib/reminder-engine";
import { logAudit } from "@/lib/audit";

export async function reviewUrlDeEquipo(tenantId: string): Promise<string | null> {
  const [team] = await getDb()
    .select({
      googlePlaceId: teams.googlePlaceId,
      googleReviewUrl: teams.googleReviewUrl,
    })
    .from(teams)
    .where(eq(teams.id, tenantId))
    .limit(1);
  return (
    team?.googleReviewUrl ||
    (team?.googlePlaceId
      ? `https://search.google.com/local/writereview?placeid=${team.googlePlaceId}`
      : null)
  );
}

export function plantillaResena(opts: {
  clinicaNombre: string;
  pacienteNombre: string;
  reviewUrl: string;
}): { asunto: string; html: string; texto: string } {
  const primer = opts.pacienteNombre.split(" ")[0] ?? opts.pacienteNombre;
  const asunto = `¿Cómo estuvo tu visita a ${opts.clinicaNombre}?`;
  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f6f5f3;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f3;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0d9488;padding:20px 32px;">
          <p style="margin:0;color:#ffffff;font-size:16px;font-weight:bold;">${opts.clinicaNombre} · Clinicflow</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#1f2937;">Hola, ${primer}</h1>
          <div style="font-size:14px;line-height:1.6;color:#374151;">
            <p>Gracias por visitarnos. Tu opinión nos ayuda mucho: ¿podrías contarnos cómo estuvo tu experiencia?</p>
            <p style="margin:24px 0;"><a href="${opts.reviewUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:14px;">Escribir mi reseña</a></p>
            <p>Te tomará menos de un minuto.</p>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Este correo fue enviado por ${opts.clinicaNombre} a través de Clinicflow.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const texto = `Hola, ${primer}\n\n¿Cómo estuvo tu visita? Tu opinión nos ayuda mucho.\n\nEscribe tu reseña aquí: ${opts.reviewUrl}`;
  return { asunto, html, texto };
}

export async function solicitarResena(opts: {
  tenantId: string;
  appointmentId?: string | null;
  patientId: string;
  canal?: string;
  automatico?: boolean;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const db = getDb();
  const canal = opts.canal ?? "email";

  let filaExistenteId: string | null = null;
  if (opts.appointmentId) {
    const [enviada] = await db
      .select({ id: reviewRequests.id })
      .from(reviewRequests)
      .where(
        and(
          eq(reviewRequests.tenantId, opts.tenantId),
          eq(reviewRequests.appointmentId, opts.appointmentId),
          isNotNull(reviewRequests.enviadoAt),
        ),
      )
      .limit(1);
    if (enviada) return { ok: false, error: "ya_solicitada" };

    const [fallida] = await db
      .select({ id: reviewRequests.id })
      .from(reviewRequests)
      .where(
        and(
          eq(reviewRequests.tenantId, opts.tenantId),
          eq(reviewRequests.appointmentId, opts.appointmentId),
          isNull(reviewRequests.enviadoAt),
        ),
      )
      .limit(1);
    filaExistenteId = fallida?.id ?? null;
  }

  const [patient] = await db
    .select({ id: patients.id, nombre: patients.nombre, email: patients.email })
    .from(patients)
    .where(and(eq(patients.tenantId, opts.tenantId), eq(patients.id, opts.patientId)))
    .limit(1);
  if (!patient) return { ok: false, error: "paciente_no_encontrado" };
  if (!patient.email) return { ok: false, error: "paciente_sin_email" };

  const reviewUrl = await reviewUrlDeEquipo(opts.tenantId);
  if (!reviewUrl) {
    await dejarTrazadeFallida({ ...opts, canal, filaExistenteId, patientId: patient.id });
    return { ok: false, error: "resenas_no_configuradas" };
  }
  if (!mailConfigurado()) {
    await dejarTrazadeFallida({ ...opts, canal, filaExistenteId, patientId: patient.id });
    return { ok: false, error: "email_no_configurado" };
  }

  const [team] = await db
    .select({ name: teams.name })
    .from(teams)
    .where(eq(teams.id, opts.tenantId))
    .limit(1);

  const tpl = plantillaResena({
    clinicaNombre: team?.name ?? "Tu clínica",
    pacienteNombre: patient.nombre,
    reviewUrl,
  });
  const envio = await sendMail({
    to: patient.email,
    subject: tpl.asunto,
    html: tpl.html,
    text: tpl.texto,
  });
  if (!envio.ok) return { ok: false, error: envio.reason ?? "error_email" };

  const id = filaExistenteId
    ? (
        await db
          .update(reviewRequests)
          .set({ enviadoAt: new Date(), canal })
          .where(eq(reviewRequests.id, filaExistenteId))
          .returning({ id: reviewRequests.id })
      )[0]?.id
    : (
        await db
          .insert(reviewRequests)
          .values({
            tenantId: opts.tenantId,
            patientId: patient.id,
            appointmentId: opts.appointmentId ?? null,
            canal,
            enviadoAt: new Date(),
          })
          .returning({ id: reviewRequests.id })
      )[0]?.id;

  return { ok: true, id };
}

async function dejarTrazadeFallida(opts: {
  tenantId: string;
  appointmentId?: string | null;
  patientId: string;
  canal: string;
  filaExistenteId: string | null;
  automatico?: boolean;
}): Promise<void> {
  if (opts.filaExistenteId) return;
  const db = getDb();
  const [fila] = await db
    .insert(reviewRequests)
    .values({
      tenantId: opts.tenantId,
      patientId: opts.patientId,
      appointmentId: opts.appointmentId ?? null,
      canal: opts.canal,
      enviadoAt: null,
    })
    .returning({ id: reviewRequests.id });
  void logAudit({
    tenantId: opts.tenantId,
    accion: "resena.solicitar_fallida",
    entidad: "review_requests",
    entidadId: fila?.id,
    payload: {
      pacienteId: opts.patientId,
      automatico: opts.automatico ?? false,
    },
  });
}

export async function resenaAutomaticaSiAplica(opts: {
  tenantId: string;
  appointmentId: string;
  patientId: string;
}): Promise<void> {
  const settings = await getNotificationSettings(opts.tenantId).catch(() => null);
  if (!settings || !settings.resenaAutomatica) return;
  await solicitarResena({
    tenantId: opts.tenantId,
    appointmentId: opts.appointmentId,
    patientId: opts.patientId,
    automatico: true,
  }).catch(() => {});
}
