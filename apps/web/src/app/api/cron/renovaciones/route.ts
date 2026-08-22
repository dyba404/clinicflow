import { NextResponse } from "next/server";
import { and, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { getDb, teams, subscriptions, auditLogs } from "@clinicflow/db";
import { mailConfigurado, sendMail, appBaseUrl } from "@/lib/mail";
import { emailOwner } from "@/lib/digest";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

function bearerValido(req: Request): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${esperado}`;
}

function fechaLocal(timezone: string, dias: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
    new Date(Date.now() + dias * 24 * 3600_000),
  );
}

async function yaNotificado(tenantId: string, accion: string): Promise<boolean> {
  const desde = new Date(Date.now() - 24 * 3600_000);
  const [fila] = await getDb()
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.accion, accion), gte(auditLogs.createdAt, desde)))
    .limit(1);
  return Boolean(fila);
}

type ResultadoAviso = "enviado" | "sin_mail" | "ya_notificado" | "sin_owner" | "fallo_envio";

async function avisarOwner(opts: {
  tenantId: string;
  tenantNombre: string;
  accion: string;
  asunto: string;
  cuerpo: string;
}): Promise<ResultadoAviso> {
  if (await yaNotificado(opts.tenantId, opts.accion)) return "ya_notificado";
  const owner = await emailOwner(opts.tenantId);
  if (!owner) return "sin_owner";

  if (!mailConfigurado()) {
    void logAudit({
      tenantId: opts.tenantId,
      accion: opts.accion,
      entidad: "subscriptions",
      entidadId: opts.tenantId,
      payload: { destinatario: owner, enviado: false, motivo: "email_no_configurado" },
    });
    return "sin_mail";
  }

  const url = `${appBaseUrl()}/consola/config/suscripcion`;
  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f6f5f3;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f3;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0d9488;padding:20px 32px;">
          <p style="margin:0;color:#ffffff;font-size:16px;font-weight:bold;">${opts.tenantNombre} · Clinicflow</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <div style="font-size:14px;line-height:1.6;color:#374151;"><p>${opts.cuerpo}</p>
          <p style="margin:24px 0;"><a href="${url}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:14px;">Renovar mi plan</a></p>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Este correo fue enviado automáticamente por Clinicflow.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const texto = `${opts.cuerpo}\n\nRenueva aquí: ${url}`;
  const r = await sendMail({ to: owner, subject: opts.asunto, html, text: texto });

  void logAudit({
    tenantId: opts.tenantId,
    accion: opts.accion,
    entidad: "subscriptions",
    entidadId: opts.tenantId,
    payload: { destinatario: owner, enviado: r.ok },
  });
  return r.ok ? "enviado" : "fallo_envio";
}

export async function POST(req: Request) {
  if (!bearerValido(req)) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  const db = getDb();
  const limite = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
  }).format(new Date(Date.now() + 3 * 24 * 3600_000));

  const [sinVenceFila] = await db
    .select({ n: sql<number>`count(*)` })
    .from(subscriptions)
    .where(and(eq(subscriptions.estado, "activo"), isNull(subscriptions.vence)));
  const sinVencimiento = Number(sinVenceFila?.n ?? 0);

  const filas = await db
    .update(subscriptions)
    .set({ estado: "por_renovar", updatedAt: new Date() })
    .where(
      and(
        eq(subscriptions.estado, "activo"),
        isNotNull(subscriptions.vence),
        lte(subscriptions.vence, limite),
      ),
    )
    .returning({ tenantId: subscriptions.tenantId, vence: subscriptions.vence });

  for (const f of filas) {
    const [team] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, f.tenantId))
      .limit(1);
    await avisarOwner({
      tenantId: f.tenantId,
      tenantNombre: team?.name ?? "Tu clínica",
      accion: "suscripcion.por_renovar",
      asunto: `Tu plan de Clinicflow vence pronto (${f.vence ?? "pronto"})`,
      cuerpo: `Tu suscripción de Clinicflow vence el <strong>${f.vence ?? "próximamente"}</strong>. Para no perder el acceso a los módulos premium, renueva tu plan ahora.`,
    });
  }

  let avisosVencimiento = 0;
  let suspendidas = 0;
  const clinics = await db
    .select({ id: teams.id, name: teams.name, timezone: teams.timezone })
    .from(teams);

  for (const team of clinics) {
    const [sub] = await db
      .select({ estado: subscriptions.estado, vence: subscriptions.vence })
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, team.id))
      .limit(1);
    if (!sub || !sub.vence) continue;

    const hoy = fechaLocal(team.timezone, 0);
    const finGracia = fechaLocal(team.timezone, -7);

    if (
      (sub.estado === "activo" || sub.estado === "por_renovar") &&
      sub.vence === hoy
    ) {
      const aviso = await avisarOwner({
        tenantId: team.id,
        tenantNombre: team.name,
        accion: "suscripcion.vencida",
        asunto: `Tu plan de Clinicflow vence hoy`,
        cuerpo: `Tu suscripción de Clinicflow vence <strong>hoy</strong>. Tienes 7 días de gracia antes de la suspensión. Renueva para mantener el servicio activo.`,
      });
      if (aviso === "enviado" || aviso === "sin_mail") avisosVencimiento++;
    }

    if (sub.estado !== "suspendido" && sub.estado !== "cancelado" && sub.vence <= finGracia) {
      await db
        .update(subscriptions)
        .set({ estado: "suspendido", updatedAt: new Date() })
        .where(eq(subscriptions.tenantId, team.id));
      void logAudit({
        tenantId: team.id,
        accion: "suscripcion.suspender_auto",
        entidad: "subscriptions",
        entidadId: team.id,
        payload: { vence: sub.vence },
      });
      await avisarOwner({
        tenantId: team.id,
        tenantNombre: team.name,
        accion: "suscripcion.suspendido_aviso",
        asunto: `Cuenta suspendida: tu plan de Clinicflow venció`,
        cuerpo: `Tu suscripción de Clinicflow venció hace más de 7 días y la cuenta quedó <strong>suspendida</strong>: los módulos premium están desactivados. Renueva para reactivar todo al instante.`,
      });
      suspendidas++;
    }
  }

  return NextResponse.json({
    ok: true,
    marcadas: filas.length,
    sinVencimiento,
    avisosVencimiento,
    suspendidas,
  });
}
