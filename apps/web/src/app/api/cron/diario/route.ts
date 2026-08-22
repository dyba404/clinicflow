import { NextResponse } from "next/server";
import { getDb, teams } from "@clinicflow/db";
import { mailConfigurado, sendMail } from "@/lib/mail";
import { computarDigest, emailOwner, plantillaDigest } from "@/lib/digest";
import { getNotificationSettings } from "@/lib/reminder-engine";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

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
  if (!mailConfigurado()) {
    return NextResponse.json({ ok: true, omitido: "email_no_configurado", enviados: 0 });
  }

  const db = getDb();
  const clinics = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug, timezone: teams.timezone })
    .from(teams);

  let enviados = 0;
  let omitidos = 0;

  for (const team of clinics) {
    const settings = await getNotificationSettings(team.id);
    if (settings && !settings.digestDiario) {
      omitidos++;
      continue;
    }

    const digest = await computarDigest({ tenantId: team.id, timezone: team.timezone });
    if (digest.totalPendientes === 0) {
      omitidos++;
      continue;
    }

    const owner = await emailOwner(team.id);
    if (!owner) {
      omitidos++;
      continue;
    }

    const fecha = new Intl.DateTimeFormat("es-PE", {
      timeZone: team.timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());

    const tpl = plantillaDigest({
      clinicaNombre: team.name,
      fecha: fecha.charAt(0).toUpperCase() + fecha.slice(1),
      secciones: digest.secciones,
    });
    const r = await sendMail({
      to: owner,
      subject: tpl.asunto,
      html: tpl.html,
      text: tpl.texto,
    });
    if (r.ok) enviados++;
    else omitidos++;

    void logAudit({
      tenantId: team.id,
      accion: "digest.enviar",
      entidad: "teams",
      entidadId: team.id,
      payload: { destinatario: owner, enviado: r.ok, pendientes: digest.totalPendientes },
    });
  }

  return NextResponse.json({ ok: true, enviados, omitidos });
}
