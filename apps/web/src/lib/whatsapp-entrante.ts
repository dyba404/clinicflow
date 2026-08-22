import { and, asc, eq, gte, lte, inArray } from "drizzle-orm";
import { getDb, appointments, reminders, services, teams, whatsappMessages } from "@clinicflow/db";
import { logAudit } from "@/lib/audit";
import { descifrar } from "@/lib/crypto";
import { ensureMagicToken, magicUrl } from "@/lib/magic-link";
import {
  enviarWhatsApp,
  whatsAppConfigurada,
  type WhatsAppResultado,
} from "@/lib/whatsapp";
import { getWhatsAppSettings } from "@/lib/reminder-engine";
import { fechaLargaEs, plantillaConfirmacionSolicitud } from "@/lib/notify";
import { enviarRecordatorio } from "@/lib/reminder-engine";
import { appBaseUrl } from "@/lib/mail";

const KEYWORDS_CONFIRMAR = new Set([
  "SI",
  "CONFIRMO",
  "CONFIRMAR",
  "CONFIRME",
  "CONFIRMADO",
  "CONFIRMADA",
  "ASISTO",
  "ASISTIRE",
  "OK",
  "DALE",
]);

const KEYWORDS_GESTIONAR = new Set([
  "REPROGRAMAR",
  "REPROGRAMO",
  "CANCELAR",
  "CANCEL",
  "CAMBIAR",
  "CAMBIO",
  "NO PUEDO",
  "NO VOY",
]);

export type AccionEntrante = "confirmar" | "gestionar" | null;

export function clasificarMensaje(texto: string): AccionEntrante {
  const normalizado = texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?¡¿"()]/g, " ")
    .trim();
  if (!normalizado) return null;
  const palabras = normalizado.split(/\s+/);
  if (palabras.some((p) => KEYWORDS_GESTIONAR.has(p))) return "gestionar";
  if (palabras.some((p) => KEYWORDS_CONFIRMAR.has(p))) return "confirmar";
  return null;
}

function fechaLima(d: Date, tz = "America/Lima"): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const p: Record<string, string> = {};
  for (const q of partes) p[q.type] = q.value;
  return `${p.year}-${p.month}-${p.day}`;
}

function inicioDeDiaLima(d: Date, tz = "America/Lima"): Date {
  const fecha = fechaLima(d, tz);
  return new Date(`${fecha}T00:00:00-05:00`);
}

export type ReplyMode = "silent" | "single" | "full";

export function getReplyMode(): ReplyMode {
  const bruto = (process.env.WA_REPLY_MODE ?? "").trim().toLowerCase();
  if (bruto === "silent" || bruto === "full") return bruto;
  return "single";
}

export interface ResultadoEntrante {
  ok: boolean;
  accion: AccionEntrante;
  respuesta?: string;
  estadoCita?: string;
  motivo?: string;
}

export async function registrarMensajeWhatsAppSaliente(opts: {
  tenantId: string;
  patientId: string | null;
  waId: string;
  body: string;
  envio: WhatsAppResultado;
  extra?: Record<string, unknown>;
}): Promise<string | null> {
  try {
    const [fila] = await getDb()
      .insert(whatsappMessages)
      .values({
        tenantId: opts.tenantId,
        waId: opts.waId,
        direction: "out",
        patientId: opts.patientId,
        phoneNumber: opts.waId,
        body: opts.body.slice(0, 1000),
        estado: opts.envio.ok ? "enviado" : "error",
        error: opts.envio.ok ? null : (opts.envio.reason ?? "error_whatsapp"),
      })
      .returning({ id: whatsappMessages.id });
    void logAudit({
      tenantId: opts.tenantId,
      accion: "whatsapp.mensaje_saliente",
      entidad: "whatsapp",
      ...(fila?.id ? { entidadId: fila.id } : {}),
      payload: {
        numero: opts.waId,
        enviado: opts.envio.ok,
        ...(opts.extra ?? {}),
      },
    });
    return fila?.id ?? null;
  } catch {
    return null;
  }
}

async function buscarCitaProxima(opts: {
  tenantId: string;
  patientId: string;
  teamTimezone: string;
}) {
  const diaHoy = fechaLima(new Date(), opts.teamTimezone);
  const diaMax = fechaLima(new Date(Date.now() + 48 * 3600_000), opts.teamTimezone);
  const [cita] = await getDb()
    .select({
      id: appointments.id,
      estado: appointments.estado,
      fecha: appointments.fecha,
      horaIni: appointments.horaIni,
      serviceId: appointments.serviceId,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, opts.tenantId),
        eq(appointments.patientId, opts.patientId),
        inArray(appointments.estado, ["solicitada", "confirmada"]),
        gte(appointments.fecha, diaHoy),
        lte(appointments.fecha, diaMax),
      ),
    )
    .orderBy(asc(appointments.fecha), asc(appointments.horaIni))
    .limit(1);
  return cita ?? null;
}

async function marcarRespuestaDiaria(opts: {
  tenantId: string;
  patientId: string;
  citaId: string | null;
  waId: string;
  mensaje: string;
  estado: "enviado" | "error";
  error: string | null;
}): Promise<string | null> {
  try {
    const [rem] = await getDb()
      .insert(reminders)
      .values({
        tenantId: opts.tenantId,
        tipo: "confirmacion_solicitud",
        estado: opts.estado,
        pacienteId: opts.patientId,
        citaId: opts.citaId,
        canal: "whatsapp",
        destinatario: opts.waId,
        mensaje: opts.mensaje,
        error: opts.error,
        enviadoAt: new Date(),
      })
      .returning({ id: reminders.id });
    return rem?.id ?? null;
  } catch {
    return null;
  }
}

interface CtxSaliente {
  waSettings: {
    activo: boolean;
    phoneNumberId: string | null;
    tokenEnc: string | null;
  } | null;
  token: string | null;
}

async function resolverCtxSaliente(tenantId: string): Promise<CtxSaliente> {
  const waSettings = await getWhatsAppSettings(tenantId);
  if (!whatsAppConfigurada(waSettings) || !waSettings?.phoneNumberId || !waSettings.tokenEnc) {
    return { waSettings, token: null };
  }
  try {
    return { waSettings, token: descifrar(waSettings.tokenEnc) };
  } catch {
    return { waSettings, token: null };
  }
}

async function procesarSinKeyword(opts: {
  tenantId: string;
  patientId: string;
  waId: string;
  texto: string;
  team: { name: string; slug: string; timezone: string };
}): Promise<ResultadoEntrante> {
  const modo = getReplyMode();
  if (modo === "silent") {
    void logAudit({
      tenantId: opts.tenantId,
      accion: "whatsapp.auto_respuesta",
      entidad: "whatsapp",
      payload: { accion: null, modo, omitido: "modo_silencioso" },
    });
    return { ok: true, accion: null, motivo: "sin_keyword" };
  }

  const urlReserva = `${appBaseUrl()}/${opts.team.slug}/reserva`;
  const respuesta = `Hola 👋 En ${opts.team.name} recibimos tu mensaje. Reserva o gestiona tu cita en: ${urlReserva}`;

  if (modo === "single") {
    const ctx = await resolverCtxSaliente(opts.tenantId);
    if (!ctx.waSettings || !ctx.token || !ctx.waSettings.phoneNumberId) {
      void logAudit({
        tenantId: opts.tenantId,
        accion: "whatsapp.auto_respuesta",
        entidad: "whatsapp",
        payload: { accion: null, modo, omitido: "whatsapp_no_configurado" },
      });
      return { ok: false, accion: null, motivo: "whatsapp_no_configurado" };
    }

    const envio = await enviarWhatsApp(opts.waId, ctx.token, ctx.waSettings.phoneNumberId, respuesta);
    await registrarMensajeWhatsAppSaliente({
      tenantId: opts.tenantId,
      patientId: opts.patientId,
      waId: opts.waId,
      body: respuesta,
      envio,
      extra: { modo, context: "sin_keyword" },
    });
    void logAudit({
      tenantId: opts.tenantId,
      accion: "whatsapp.auto_respuesta",
      entidad: "whatsapp",
      payload: {
        accion: null,
        modo,
        enviado: envio.ok,
        motivo: envio.ok ? null : (envio.reason ?? "error_whatsapp"),
      },
    });
    return {
      ok: envio.ok,
      accion: null,
      respuesta,
      motivo: envio.ok ? undefined : (envio.reason ?? "error_whatsapp"),
    };
  }

  void logAudit({
    tenantId: opts.tenantId,
    accion: "whatsapp.auto_respuesta",
    entidad: "whatsapp",
    payload: { accion: null, modo, omitido: "sin_keyword" },
  });
  return { ok: false, accion: null, motivo: "sin_keyword" };
}

export async function procesarMensajeEntrante(opts: {
  tenantId: string;
  patientId: string;
  patientEmail: string | null;
  waId: string;
  texto: string;
}): Promise<ResultadoEntrante> {
  const accion = clasificarMensaje(opts.texto);
  const modo = getReplyMode();

  const db = getDb();
  const [team] = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug, timezone: teams.timezone })
    .from(teams)
    .where(eq(teams.id, opts.tenantId))
    .limit(1);
  if (!team) return { ok: false, accion, motivo: "tenant_no_encontrado" };

  if (!accion) return procesarSinKeyword({ ...opts, team });

  const hoy = inicioDeDiaLima(new Date(), team.timezone);
  const [previo] = await db
    .select({ id: reminders.id })
    .from(reminders)
    .where(
      and(
        eq(reminders.tenantId, opts.tenantId),
        eq(reminders.pacienteId, opts.patientId),
        eq(reminders.tipo, "confirmacion_solicitud"),
        eq(reminders.canal, "whatsapp"),
        gte(reminders.createdAt, hoy),
      ),
    )
    .limit(1);
  if (previo) {
    void logAudit({
      tenantId: opts.tenantId,
      accion: "whatsapp.auto_respuesta",
      entidad: "whatsapp",
      payload: { accion, modo, omitido: "una_respuesta_por_dia" },
    });
    return { ok: false, accion, motivo: "ya_respondido_hoy" };
  }

  const cita = await buscarCitaProxima({
    tenantId: opts.tenantId,
    patientId: opts.patientId,
    teamTimezone: team.timezone,
  });

  if (!cita) {
    void logAudit({
      tenantId: opts.tenantId,
      accion: "whatsapp.auto_respuesta",
      entidad: "whatsapp",
      payload: { accion, modo, omitido: "sin_cita_proxima" },
    });
    if (modo === "single") {
      const ctx = await resolverCtxSaliente(opts.tenantId);
      if (!ctx.waSettings || !ctx.token || !ctx.waSettings.phoneNumberId) {
        return { ok: false, accion, motivo: "whatsapp_no_configurado" };
      }
      const respuesta = `Por ahora no vemos una cita próxima a tu nombre. Puedes reservar o revisar citas en: ${appBaseUrl()}/${team.slug}/reserva`;
      const envio = await enviarWhatsApp(opts.waId, ctx.token, ctx.waSettings.phoneNumberId, respuesta);
      await registrarMensajeWhatsAppSaliente({
        tenantId: opts.tenantId,
        patientId: opts.patientId,
        waId: opts.waId,
        body: respuesta,
        envio,
        extra: { modo, context: "sin_cita_proxima" },
      });
      return {
        ok: envio.ok,
        accion,
        respuesta,
        motivo: envio.ok ? "sin_cita_proxima" : (envio.reason ?? "error_whatsapp"),
      };
    }
    return { ok: false, accion, motivo: "sin_cita_proxima" };
  }

  const ctx = await resolverCtxSaliente(opts.tenantId);
  if (modo !== "silent" && (!ctx.waSettings || !ctx.token || !ctx.waSettings.phoneNumberId)) {
    return { ok: false, accion, motivo: "whatsapp_no_configurado" };
  }

  let respuesta = "";
  let estadoCita = cita.estado as string;

  if (accion === "gestionar") {
    const mgToken = await ensureMagicToken(opts.tenantId, opts.patientId, cita.id);
    if (modo === "full") {
      respuesta = `Claro, puedes reprogramar o cancelar tu cita del ${fechaLargaEs(cita.fecha)} a las ${cita.horaIni} aquí: ${magicUrl(team.slug, mgToken)}\nEl enlace es personal y válido por 30 días.`;
    } else {
      respuesta = `Para reprogramar o cancelar tu cita del ${fechaLargaEs(cita.fecha)} a las ${cita.horaIni}: ${magicUrl(team.slug, mgToken)} (enlace personal, válido 30 días).`;
    }
  } else {
    if (cita.estado === "solicitada") {
      const [updated] = await db
        .update(appointments)
        .set({ estado: "confirmada", updatedAt: new Date() })
        .where(and(eq(appointments.id, cita.id), eq(appointments.estado, "solicitada")))
        .returning({ id: appointments.id, estado: appointments.estado });
      if (updated) {
        estadoCita = updated.estado;
        void logAudit({
          tenantId: opts.tenantId,
          accion: "whatsapp.auto_confirmacion",
          entidad: "citas",
          entidadId: cita.id,
          payload: { via: "whatsapp_entrante", numero: opts.waId },
        });

        const [svc] = await db
          .select({ nombre: services.nombre })
          .from(services)
          .where(eq(services.id, cita.serviceId))
          .limit(1);
        if (opts.patientEmail) {
          const plantilla = plantillaConfirmacionSolicitud({
            cita: {
              fecha: cita.fecha,
              horaIni: cita.horaIni,
              servicio: svc?.nombre ?? "",
              clinicaNombre: team.name,
              clinicaSlug: team.slug,
            },
            magicUrl: magicUrl(team.slug, await ensureMagicToken(opts.tenantId, opts.patientId, cita.id)),
          });
          await enviarRecordatorio({
            tenantId: opts.tenantId,
            tipo: "confirmacion_solicitud",
            pacienteId: opts.patientId,
            citaId: cita.id,
            destinatario: opts.patientEmail,
            plantilla,
            celularPaciente: null,
          }).catch(() => {});
        }
      }
      if (modo === "full") {
        respuesta = `✓ Tu cita quedó confirmada para el ${fechaLargaEs(cita.fecha)} a las ${cita.horaIni}. Te esperamos. Si necesitas cambiarla, responde CAMBIAR y te enviaremos un enlace.`;
      } else {
        respuesta = `✓ Tu cita quedó confirmada para el ${fechaLargaEs(cita.fecha)} a las ${cita.horaIni}. Para gestionarla usa este enlace personal (válido 30 días): ${magicUrl(team.slug, await ensureMagicToken(opts.tenantId, opts.patientId, cita.id))}`;
      }
    } else {
      if (modo === "full") {
        respuesta = `¡Gracias! Tu cita ya está confirmada para el ${fechaLargaEs(cita.fecha)} a las ${cita.horaIni}. Te esperamos.`;
      } else {
        respuesta = `¡Gracias! Tu cita ya está confirmada para el ${fechaLargaEs(cita.fecha)} a las ${cita.horaIni}. Para gestionarla: ${magicUrl(team.slug, await ensureMagicToken(opts.tenantId, opts.patientId, cita.id))} (enlace personal, válido 30 días).`;
      }
    }
  }

  if (modo === "silent") {
    void logAudit({
      tenantId: opts.tenantId,
      accion: "whatsapp.auto_respuesta",
      entidad: "whatsapp",
      payload: { accion, modo, omitido: "modo_silencioso", estadoCita },
    });
    return { ok: true, accion, respuesta, estadoCita };
  }

  const envio: WhatsAppResultado = await enviarWhatsApp(
    opts.waId,
    ctx.token!,
    ctx.waSettings!.phoneNumberId!,
    respuesta,
  );

  await registrarMensajeWhatsAppSaliente({
    tenantId: opts.tenantId,
    patientId: opts.patientId,
    waId: opts.waId,
    body: respuesta,
    envio,
    extra: { modo, context: accion },
  });

  const remId = await marcarRespuestaDiaria({
    tenantId: opts.tenantId,
    patientId: opts.patientId,
    citaId: cita.id,
    waId: opts.waId,
    mensaje: respuesta,
    estado: envio.ok ? "enviado" : "error",
    error: envio.ok ? null : (envio.reason ?? "error_whatsapp"),
  });

  void logAudit({
    tenantId: opts.tenantId,
    accion: "whatsapp.auto_respuesta",
    entidad: "reminders",
    ...(remId ? { entidadId: remId } : {}),
    payload: {
      accion,
      modo,
      estadoCita,
      enviado: envio.ok,
      motivo: envio.ok ? null : (envio.reason ?? "error_whatsapp"),
    },
  });

  return { ok: envio.ok, accion, respuesta, estadoCita, motivo: envio.ok ? undefined : envio.reason };
}
