import { getDb, teams } from "@clinicflow/db";
import { eq } from "drizzle-orm";
import { descifrar } from "@/lib/crypto";
import { enviarWhatsApp, normalizarCelularE164, whatsAppConfigurada } from "@/lib/whatsapp";
import { getWhatsAppSettings } from "@/lib/reminder-engine";
import { sendMail, mailConfigurado } from "@/lib/mail";

export interface NotificarResultado {
  ok: boolean;
  canal: "whatsapp" | "email" | "ninguno";
  error?: string;
}

export async function notificarPaciente(opts: {
  tenantId: string;
  celular: string | null;
  email: string | null;
  mensajeWhatsApp: string;
  emailAsunto: string;
  emailHtml: string;
  emailTexto: string;
}): Promise<NotificarResultado> {
  const waSettings = await getWhatsAppSettings(opts.tenantId);
  if (whatsAppConfigurada(waSettings) && waSettings?.tokenEnc && opts.celular) {
    const e164 = normalizarCelularE164(opts.celular);
    if (e164) {
      try {
        const token = descifrar(waSettings.tokenEnc);
        const r = await enviarWhatsApp(e164, token, waSettings.phoneNumberId ?? "", opts.mensajeWhatsApp);
        if (r.ok) return { ok: true, canal: "whatsapp" };
      } catch {
        // cae al email
      }
    }
  }

  if (mailConfigurado() && opts.email) {
    const r = await sendMail({
      to: opts.email,
      subject: opts.emailAsunto,
      html: opts.emailHtml,
      text: opts.emailTexto,
    });
    if (r.ok) return { ok: true, canal: "email" };
    return { ok: false, canal: "ninguno", error: r.reason };
  }

  return { ok: false, canal: "ninguno", error: "sin_canal" };
}

export async function nombreClinica(tenantId: string): Promise<string> {
  const rows = await getDb().select({ name: teams.name }).from(teams).where(eq(teams.id, tenantId)).limit(1);
  return rows[0]?.name ?? "la clínica";
}
