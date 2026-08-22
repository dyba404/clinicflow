import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";

let cliente: Resend | null = null;
let transporterSmtp: Transporter | null = null;

export type MailModo = "resend" | "smtp-dev";

export function mailModo(): MailModo {
  return process.env.MAIL_MODE === "smtp-dev" ? "smtp-dev" : "resend";
}

export function mailConfigurado(): boolean {
  if (mailModo() === "smtp-dev") return true;
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

export function mailFrom(): string | null {
  const from = process.env.RESEND_FROM;
  if (from) return from;
  if (mailModo() === "smtp-dev") return "dev@clinicflow.local";
  return null;
}

export function mailEstadoHumano(): string {
  if (mailModo() === "smtp-dev") {
    return "SMTP dev (Mailpit) → localhost:8026";
  }
  if (mailConfigurado()) return "Resend (producción)";
  return "No configurado";
}

function smtpTransporter(): Transporter {
  if (!transporterSmtp) {
    transporterSmtp = nodemailer.createTransport({
      host: process.env.MAILPIT_HOST ?? "127.0.0.1",
      port: Number(process.env.MAILPIT_PORT ?? "1026"),
      secure: false,
      tls: { rejectUnauthorized: false },
    });
  }
  return transporterSmtp;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const from = mailFrom();

  if (mailModo() === "smtp-dev") {
    if (!from) return { ok: false, reason: "from_no_configurado" };
    try {
      await smtpTransporter().sendMail({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "error_smtp" };
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "email_no_configurado" };
  if (!from) return { ok: false, reason: "from_no_configurado (define RESEND_FROM)" };

  try {
    if (!cliente) cliente = new Resend(apiKey);
    const res = await cliente.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (res.error) return { ok: false, reason: res.error.message ?? "error_resend" };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "error_envio" };
  }
}

export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
