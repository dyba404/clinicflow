import { desc, eq } from "drizzle-orm";
import { getDb, reminders, notificationSettings, whatsappSettings } from "@clinicflow/db";
import { sendMail } from "@/lib/mail";
import { descifrar } from "@/lib/crypto";
import {
  enviarPlantillaWhatsApp,
  enviarWhatsApp,
  normalizarCelularE164,
  whatsAppConfigurada,
} from "@/lib/whatsapp";
import type { PlantillaEmail } from "@/lib/notify";

export type ReminderTipo =
  | "recordatorio_24h"
  | "confirmacion_solicitud"
  | "recall"
  | "reprogramacion"
  | "waitlist";

export async function getNotificationSettings(tenantId: string) {
  const rows = await getDb()
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.tenantId, tenantId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getWhatsAppSettings(tenantId: string) {
  const rows = await getDb()
    .select()
    .from(whatsappSettings)
    .where(eq(whatsappSettings.tenantId, tenantId))
    .limit(1);
  return rows[0] ?? null;
}

export function canalesActivos(
  tipo: ReminderTipo,
  settings: Awaited<ReturnType<typeof getNotificationSettings>>,
): string[] {
  const canales =
    tipo === "recordatorio_24h"
      ? settings?.recordatorio24hCanales
      : tipo === "confirmacion_solicitud"
        ? settings?.confirmacionCanales
        : tipo === "reprogramacion"
          ? settings?.confirmacionCanales
          : null;
  return (canales ?? "email")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export async function enviarRecordatorio(opts: {
  tenantId: string;
  tipo: ReminderTipo;
  pacienteId: string | null;
  citaId: string | null;
  destinatario: string | null;
  plantilla: PlantillaEmail;
  enviadoPor?: string | null;
  celularPaciente?: string | null;
  waPlantilla?: { nombre: string; idioma: string; parametros: string[] };
  reminderIdActualizar?: string | null;
}): Promise<{ ok: boolean; reminderId: string; error?: string }> {
  const db = getDb();

  const guardar = async (valores: {
    estado: "enviado" | "error";
    canal: string;
    destinatario: string | null;
    error: string | null;
    mensaje: string;
  }): Promise<string> => {
    const base = {
      tipo: opts.tipo,
      estado: valores.estado,
      pacienteId: opts.pacienteId,
      citaId: opts.citaId,
      canal: valores.canal,
      destinatario: valores.destinatario,
      mensaje: valores.mensaje,
      error: valores.error,
      enviadoPor: opts.enviadoPor ?? null,
      enviadoAt: new Date(),
    };
    if (opts.reminderIdActualizar) {
      const [r] = await db
        .update(reminders)
        .set(base)
        .where(eq(reminders.id, opts.reminderIdActualizar))
        .returning({ id: reminders.id });
      return r!.id;
    }
    const [r] = await db
      .insert(reminders)
      .values({ tenantId: opts.tenantId, ...base })
      .returning({ id: reminders.id });
    return r!.id;
  };

  let canalPreferido = "email";
  let waTo: string | null = null;
  let waToken = "";
  let waPhoneId = "";
  let waNombrePlantilla = "";
  let waIdioma = "es";

  if (opts.pacienteId) {
    const settings = await getNotificationSettings(opts.tenantId);
    const canales = canalesActivos(opts.tipo, settings);
    const celular = normalizarCelularE164(opts.celularPaciente ?? null);
    if (canales.includes("whatsapp") && celular) {
      const waSettings = await getWhatsAppSettings(opts.tenantId);
      if (
        whatsAppConfigurada(waSettings) &&
        waSettings?.phoneNumberId &&
        waSettings.tokenEnc
      ) {
        try {
          waToken = descifrar(waSettings.tokenEnc);
          waPhoneId = waSettings.phoneNumberId;
          waTo = celular;
          waNombrePlantilla =
            opts.waPlantilla?.nombre ?? settings?.plantillaRecordatorio ?? "recordatorio_cita";
          waIdioma = opts.waPlantilla?.idioma ?? settings?.idiomaPlantilla ?? "es";
          canalPreferido = "whatsapp";
        } catch {
          canalPreferido = "email";
        }
      }
    }
  }

  if (canalPreferido !== "whatsapp" && !opts.destinatario) {
    const id = await guardar({
      estado: "error",
      canal: "email",
      destinatario: null,
      error: "paciente_sin_email",
      mensaje: opts.plantilla.texto,
    });
    return { ok: false, reminderId: id, error: "paciente_sin_email" };
  }

  let estado: "enviado" | "error";
  let canal = canalPreferido;
  let destino: string | null = opts.destinatario;
  let error: string | null = null;

  if (canalPreferido === "whatsapp" && waTo) {
    const esProactivo = opts.tipo === "recordatorio_24h" || opts.tipo === "recall";
    const r = esProactivo
      ? await enviarPlantillaWhatsApp(
          waTo,
          waToken,
          waPhoneId,
          waNombrePlantilla,
          waIdioma,
          opts.waPlantilla?.parametros ?? [opts.plantilla.texto],
        )
      : await enviarWhatsApp(waTo, waToken, waPhoneId, opts.plantilla.texto);
    if (r.ok) {
      estado = "enviado";
      destino = waTo;
    } else if (opts.destinatario) {
      const mail = await sendMail({
        to: opts.destinatario,
        subject: opts.plantilla.asunto,
        html: opts.plantilla.html,
        text: opts.plantilla.texto,
      });
      canal = "email";
      estado = mail.ok ? "enviado" : "error";
      error = mail.ok ? null : mail.reason;
    } else {
      estado = "error";
      error = r.reason ?? "error_whatsapp";
    }
  } else {
    canal = "email";
    const r = await sendMail({
      to: opts.destinatario!,
      subject: opts.plantilla.asunto,
      html: opts.plantilla.html,
      text: opts.plantilla.texto,
    });
    estado = r.ok ? "enviado" : "error";
    error = r.ok ? null : r.reason;
  }

  const reminderId = await guardar({
    estado,
    canal,
    destinatario: destino,
    error,
    mensaje: opts.plantilla.texto,
  });

  return { ok: estado === "enviado", reminderId, error: error ?? undefined };
}

export async function recordatoriosRecientes(tenantId: string, limite = 50) {
  return getDb()
    .select()
    .from(reminders)
    .where(eq(reminders.tenantId, tenantId))
    .orderBy(desc(reminders.createdAt))
    .limit(limite);
}
