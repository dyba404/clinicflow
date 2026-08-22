import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, campaigns, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { appBaseUrl, mailConfigurado, sendMail } from "@/lib/mail";
import { logAuditSesion } from "@/lib/audit";

type Audiencia = Array<{ patientId: string }>;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("campaigns.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  if (!mailConfigurado()) {
    return NextResponse.json({ error: "email_no_configurado" }, { status: 400 });
  }

  const db = getDb();
  const [campana] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, g.team.id)))
    .limit(1);
  if (!campana) return NextResponse.json({ error: "no_encontrado" }, { status: 404 });

  if (campana.estado !== "programada") {
    return NextResponse.json({ error: "ya_ejecutada" }, { status: 400 });
  }

  const audiencia = (campana.audiencia as Audiencia).filter((a) => a && a.patientId);
  if (audiencia.length === 0) {
    await db
      .update(campaigns)
      .set({ estado: "completada", enviadoA: 0, enviadosOk: 0, ejecutadaAt: new Date() })
      .where(eq(campaigns.id, id));
    return NextResponse.json({ ok: true, enviadosOk: 0, total: 0 });
  }

  const rows = await db
    .select({ id: patients.id, nombre: patients.nombre, email: patients.email })
    .from(patients)
    .where(
      and(
        eq(patients.tenantId, g.team.id),
        inArray(
          patients.id,
          audiencia.map((a) => a.patientId),
        ),
      ),
    );

  const reservaUrl = `${appBaseUrl()}/${g.team.slug}/reserva`;
  let enviadosOk = 0;

  for (const p of rows) {
    if (!p.email) continue;
    const titulo = campana.titulo.replaceAll("{{nombre}}", p.nombre);
    const mensaje = campana.mensaje.replaceAll("{{nombre}}", p.nombre);
    const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f6f5f3;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f3;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0d9488;padding:20px 32px;">
          <p style="margin:0;color:#ffffff;font-size:16px;font-weight:bold;">${g.team.name} · Clinicflow</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#1f2937;">${titulo}</h1>
          <div style="font-size:14px;line-height:1.6;color:#374151;">
            <p>${mensaje}</p>
            <p style="margin:24px 0;"><a href="${reservaUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:14px;">Reservar una cita</a></p>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Este correo fue enviado por ${g.team.name} a través de Clinicflow.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    const texto = `${titulo}\n\n${mensaje}\n\nReserva una cita: ${reservaUrl}\n\n— ${g.team.name} (Clinicflow)`;
    const r = await sendMail({ to: p.email, subject: titulo, html, text: texto });
    if (r.ok) enviadosOk += 1;
  }

  const totalConEmail = rows.filter((p) => p.email).length;
  const estado = totalConEmail > 0 && enviadosOk === 0 ? "error" : "completada";

  await db
    .update(campaigns)
    .set({ estado, enviadoA: totalConEmail, enviadosOk, ejecutadaAt: new Date() })
    .where(eq(campaigns.id, id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "campana.ejecutar",
    entidad: "campaigns",
    entidadId: id,
    payload: { enviadosOk, totalConEmail, audiencia: audiencia.length },
  });

  return NextResponse.json({
    ok: true,
    enviadosOk,
    total: totalConEmail,
    sinEmail: audiencia.length - rows.length + rows.filter((p) => !p.email).length,
    estado,
  });
}
