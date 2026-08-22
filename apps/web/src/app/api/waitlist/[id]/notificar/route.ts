import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, waitlists, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { appBaseUrl, mailConfigurado, sendMail } from "@/lib/mail";
import type { PlantillaEmail } from "@/lib/notify";
import { logAuditSesion } from "@/lib/audit";

function plantillaHoraDisponible(opts: {
  clinicaNombre: string;
  clinicaSlug: string;
  pacienteNombre: string;
  preferencia: string | null;
  reservaUrl: string;
}): PlantillaEmail {
  const primer = opts.pacienteNombre.split(" ")[0] ?? opts.pacienteNombre;
  const pref = opts.preferencia
    ? `<p>Según tu preferencia: <strong>${opts.preferencia}</strong>.</p>`
    : "";
  const prefTxt = opts.preferencia ? `\nSegún tu preferencia: ${opts.preferencia}.\n` : "";
  const boton = `<p style="margin:24px 0;"><a href="${opts.reservaUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:14px;">Reservar ahora</a></p>`;
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
            <p>Se liberó un cupo en <strong>${opts.clinicaNombre}</strong> y estás en la lista de espera, así que te lo ofrecemos antes que a nadie.</p>
            ${pref}
            ${boton}
            <p>El cupo es por tiempo limitado. Si no lo tomas, seguimos con el siguiente en la lista.</p>
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
  const texto = `Hola ${primer},\n\nSe liberó un cupo en ${opts.clinicaNombre} y estás en la lista de espera, así que te lo ofrecemos antes que a nadie.${prefTxt}\nReserva aquí: ${opts.reservaUrl}\n\nEl cupo es por tiempo limitado.\n\n— ${opts.clinicaNombre} (Clinicflow)`;
  return { asunto: `Hora disponible en ${opts.clinicaNombre}`, html, texto };
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("waitlist.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  if (!mailConfigurado()) {
    return NextResponse.json({ error: "email_no_configurado" }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .select({
      id: waitlists.id,
      estado: waitlists.estado,
      preferencia: waitlists.preferencia,
      patientId: waitlists.patientId,
      pacienteNombre: patients.nombre,
      pacienteEmail: patients.email,
    })
    .from(waitlists)
    .innerJoin(patients, eq(waitlists.patientId, patients.id))
    .where(and(eq(waitlists.id, id), eq(waitlists.tenantId, g.team.id)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "no_encontrado" }, { status: 404 });

  if (row.estado !== "activa") {
    return NextResponse.json({ error: "estado_invalido" }, { status: 400 });
  }
  if (!row.pacienteEmail) {
    return NextResponse.json({ error: "paciente_sin_email" }, { status: 400 });
  }

  const reservaUrl = `${appBaseUrl()}/${g.team.slug}/reserva`;
  const plantilla = plantillaHoraDisponible({
    clinicaNombre: g.team.name,
    clinicaSlug: g.team.slug,
    pacienteNombre: row.pacienteNombre,
    preferencia: row.preferencia,
    reservaUrl,
  });

  const r = await sendMail({
    to: row.pacienteEmail,
    subject: plantilla.asunto,
    html: plantilla.html,
    text: plantilla.texto,
  });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "waitlist.notificar",
    entidad: "waitlists",
    entidadId: id,
    payload: { patientId: row.patientId, ok: r.ok, reason: r.ok ? undefined : r.reason },
  });

  if (!r.ok) {
    return NextResponse.json({ error: r.reason }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
