import type { StaffRole } from "@clinicflow/core";
import { appBaseUrl, sendMail } from "@/lib/mail";

export interface CitaDatos {
  fecha: string;
  horaIni: string;
  servicio: string;
  clinicaNombre: string;
  clinicaSlug: string;
}

export function fechaLargaEs(fecha: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(new Date(`${fecha}T12:00:00`));
}

function layout(clinica: string, titulo: string, bodyHtml: string, bodyText: string) {
  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f6f5f3;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f3;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0d9488;padding:20px 32px;">
          <p style="margin:0;color:#ffffff;font-size:16px;font-weight:bold;">${clinica} · Clinicflow</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#1f2937;">${titulo}</h1>
          <div style="font-size:14px;line-height:1.6;color:#374151;">${bodyHtml}</div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Este correo fue enviado por ${clinica} a través de Clinicflow.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = `${titulo}\n\n${bodyText}\n\n— ${clinica} (Clinicflow)`;
  return { html, text };
}

function boton(href: string, label: string) {
  return `<p style="margin:24px 0;"><a href="${href}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:14px;">${label}</a></p>`;
}

export interface PlantillaEmail {
  asunto: string;
  html: string;
  texto: string;
}

export function plantillaConfirmacionSolicitud(opts: {
  cita: CitaDatos;
  magicUrl: string | null;
}): PlantillaEmail {
  const { cita, magicUrl } = opts;
  const manage = magicUrl
    ? `${boton(magicUrl, "Gestionar mi cita")}
       <p>Si necesitas reprogramar o cancelar, usa el botón de arriba. El enlace es personal, no lo compartas.</p>`
    : `<p>Si necesitas reprogramar o cancelar, comunícate con ${cita.clinicaNombre} por teléfono.</p>`;
  const bodyHtml = `
    <p>Tu solicitud fue <strong>confirmada</strong>. Te esperamos:</p>
    <ul>
      <li><strong>Fecha:</strong> ${fechaLargaEs(cita.fecha)}</li>
      <li><strong>Hora:</strong> ${cita.horaIni}</li>
      <li><strong>Servicio:</strong> ${cita.servicio}</li>
    </ul>
    ${manage}
    <p>Si no puedes asistir, por favor avísanos con anticipación.</p>`;
  const bodyText = `Tu solicitud fue confirmada.\n\nFecha: ${fechaLargaEs(cita.fecha)}\nHora: ${cita.horaIni}\nServicio: ${cita.servicio}\n\n${magicUrl ? `Para reprogramar o cancelar: ${magicUrl}` : "Para reprogramar o cancelar, comunícate con la clínica."}`;
  const tpl = layout(cita.clinicaNombre, "Tu cita quedó confirmada", bodyHtml, bodyText);
  return {
    asunto: `Cita confirmada — ${cita.fecha} ${cita.horaIni} | ${cita.clinicaNombre}`,
    html: tpl.html,
    texto: tpl.text,
  };
}

export function plantillaReprogramacionSolicitud(opts: {
  cita: CitaDatos;
  magicUrl: string | null;
}): PlantillaEmail {
  const { cita, magicUrl } = opts;
  const manage = magicUrl
    ? `${boton(magicUrl, "Gestionar mi cita")}
       <p>Si necesitas un cambio adicional, usa el botón de arriba. El enlace es personal, no lo compartas.</p>`
    : `<p>Si necesitas un cambio adicional, comunícate con ${cita.clinicaNombre} por teléfono.</p>`;
  const bodyHtml = `
    <p>Tu cita fue <strong>reprogramada</strong>. Tus nuevos datos:</p>
    <ul>
      <li><strong>Fecha:</strong> ${fechaLargaEs(cita.fecha)}</li>
      <li><strong>Hora:</strong> ${cita.horaIni}</li>
      <li><strong>Servicio:</strong> ${cita.servicio}</li>
    </ul>
    ${manage}`;
  const bodyText = `Tu cita fue reprogramada.\n\nNueva fecha: ${fechaLargaEs(cita.fecha)}\nNueva hora: ${cita.horaIni}\nServicio: ${cita.servicio}\n\n${magicUrl ? `Para gestionar: ${magicUrl}` : "Para gestionar, comunícate con la clínica."}`;
  const tpl = layout(cita.clinicaNombre, "Tu cita fue reprogramada", bodyHtml, bodyText);
  return {
    asunto: `Cita reprogramada — ${cita.fecha} ${cita.horaIni} | ${cita.clinicaNombre}`,
    html: tpl.html,
    texto: tpl.text,
  };
}

export function plantillaRechazoSolicitud(opts: { cita: CitaDatos }): PlantillaEmail {
  const { cita } = opts;
  const bodyHtml = `
    <p>Lamentamos comunicarte que tu solicitud de cita del <strong>${fechaLargaEs(cita.fecha)}</strong> a las <strong>${cita.horaIni}</strong> (${cita.servicio}) <strong>no pudo ser confirmada</strong>.</p>
    <p>Puedes intentar nuevamente con otra fecha:</p>
    ${boton(`${appBaseUrl()}/${cita.clinicaSlug}/reserva`, "Buscar nueva fecha")}`;
  const bodyText = `Tu solicitud del ${fechaLargaEs(cita.fecha)} a las ${cita.horaIni} no pudo ser confirmada.\n\nPuedes reservar otra fecha en: ${appBaseUrl()}/${cita.clinicaSlug}/reserva`;
  const tpl = layout(cita.clinicaNombre, "Sobre tu solicitud de cita", bodyHtml, bodyText);
  return {
    asunto: `Solicitud no confirmada — ${cita.clinicaNombre}`,
    html: tpl.html,
    texto: tpl.text,
  };
}

export function plantillaWaitlistOferta(opts: {
  clinicaNombre: string;
  clinicaSlug: string;
  pacienteNombre: string;
  preferencia: string | null;
  fecha: string;
  horaIni: string;
  reservaUrl: string;
}): PlantillaEmail {
  const primer = opts.pacienteNombre.split(" ")[0] ?? opts.pacienteNombre;
  const pref = opts.preferencia
    ? `<p>Según tu preferencia: <strong>${opts.preferencia}</strong>.</p>`
    : "";
  const prefTxt = opts.preferencia ? `\nSegún tu preferencia: ${opts.preferencia}.\n` : "";
  const bodyHtml = `
    <p>Se liberó un cupo en <strong>${opts.clinicaNombre}</strong> y estás en la lista de espera, así que te lo ofrecemos antes que a nadie:</p>
    <ul>
      <li><strong>Fecha:</strong> ${fechaLargaEs(opts.fecha)}</li>
      <li><strong>Hora:</strong> ${opts.horaIni}</li>
    </ul>
    ${pref}
    ${boton(opts.reservaUrl, "Reservar ahora")}
    <p>El cupo es por tiempo limitado. Si no lo tomas, seguimos con el siguiente en la lista.</p>`;
  const bodyText = `Hola ${primer},\n\nSe liberó un cupo en ${opts.clinicaNombre} y te lo ofrecemos antes que a nadie.\n\nFecha: ${fechaLargaEs(opts.fecha)}\nHora: ${opts.horaIni}${prefTxt}\nReserva aquí: ${opts.reservaUrl}\n\nEl cupo es por tiempo limitado.`;
  const tpl = layout(opts.clinicaNombre, `Hola, ${primer}`, bodyHtml, bodyText);
  return { asunto: `Hora disponible en ${opts.clinicaNombre}`, html: tpl.html, texto: tpl.text };
}

export function plantillaRecall(opts: {
  clinicaNombre: string;
  pacienteNombre: string;
  reservaUrl: string;
}): PlantillaEmail {
  const primer = opts.pacienteNombre.split(" ")[0] ?? opts.pacienteNombre;
  const cuerpo = `Hola ${primer}, hace un tiempo que no nos visitas en ${opts.clinicaNombre}. Tu salud bucal es importante: agenda un control y mantén tu sonrisa en buen estado.`;
  const tpl = layout(
    opts.clinicaNombre,
    `Hola, ${primer}`,
    `<p>${cuerpo}</p>${boton(opts.reservaUrl, "Reservar una cita")}`,
    `${cuerpo}\n\nReserva una cita: ${opts.reservaUrl}`,
  );
  return {
    asunto: `${opts.clinicaNombre} — te recordamos tu visita`,
    html: tpl.html,
    texto: tpl.text,
  };
}

export function plantillaRecordatorio24h(opts: { cita: CitaDatos }): PlantillaEmail {
  const { cita } = opts;
  const bodyHtml = `
    <p>Te recordamos que mañana tienes una cita:</p>
    <ul>
      <li><strong>Fecha:</strong> ${fechaLargaEs(cita.fecha)}</li>
      <li><strong>Hora:</strong> ${cita.horaIni}</li>
      <li><strong>Servicio:</strong> ${cita.servicio}</li>
    </ul>
    <p>Si no puedes asistir, por favor avísanos con anticipación.</p>`;
  const bodyText = `Recordatorio: mañana ${fechaLargaEs(cita.fecha)} a las ${cita.horaIni} — ${cita.servicio}.`;
  const tpl = layout(cita.clinicaNombre, "Recordatorio de tu cita de mañana", bodyHtml, bodyText);
  return {
    asunto: `Recordatorio — cita mañana a las ${cita.horaIni} | ${cita.clinicaNombre}`,
    html: tpl.html,
    texto: tpl.text,
  };
}

export function plantillaPresupuestoSeguimiento(opts: {
  clinicaNombre: string;
  clinicaSlug: string;
  pacienteNombre: string;
  titulo: string;
  total: number;
  esFinal: boolean;
  reservaUrl?: string;
}): PlantillaEmail {
  const primer = opts.pacienteNombre.split(" ")[0] ?? opts.pacienteNombre;
  const reservaUrl = opts.reservaUrl ?? `${appBaseUrl()}/${opts.clinicaSlug}/reserva`;
  const cierre = opts.esFinal
    ? "Si ya no estás interesado, igual cuéntanos: así cerramos tu expediente y dejamos de escribirte."
    : "¿Tienes dudas sobre el presupuesto o quieres agendar? Escríbenos, estamos para ayudarte.";
  const bodyHtml = `
    <p>Hola ${primer}, te escribimos para dar seguimiento a tu presupuesto <strong>${opts.titulo}</strong> por <strong>S/ ${opts.total.toFixed(2)}</strong>.</p>
    <p>${cierre}</p>
    ${boton(reservaUrl, "Agendar una cita")}`;
  const bodyText = `Hola ${primer},\n\nDamos seguimiento a tu presupuesto "${opts.titulo}" por S/ ${opts.total.toFixed(2)}.\n\n${cierre}\n\nAgenda aquí: ${reservaUrl}`;
  const tituloTpl = opts.esFinal ? "Último recordatorio de tu presupuesto" : "Seguimiento de tu presupuesto";
  const tpl = layout(opts.clinicaNombre, tituloTpl, bodyHtml, bodyText);
  return {
    asunto: `${tituloTpl} — ${opts.titulo} | ${opts.clinicaNombre}`,
    html: tpl.html,
    texto: tpl.text,
  };
}

export function plantillaPresupuestoAprobado(opts: {
  clinicaNombre: string;
  clinicaSlug: string;
  titulo: string;
  items: Array<{ descripcion: string; cantidad: number; precioUnitario: number }>;
  total: number;
  reservaUrl?: string;
}): PlantillaEmail {
  const reservaUrl = opts.reservaUrl ?? `${appBaseUrl()}/${opts.clinicaSlug}/reserva`;
  const filas = opts.items
    .map(
      (it) =>
        `<tr>
          <td style="padding:6px 0;color:#374151;">${it.descripcion} × ${it.cantidad}</td>
          <td style="padding:6px 0;text-align:right;color:#374151;white-space:nowrap;">S/ ${(it.cantidad * it.precioUnitario).toFixed(2)}</td>
        </tr>`,
    )
    .join("");
  const bodyHtml = `
    <p>Tu presupuesto <strong>${opts.titulo}</strong> fue aprobado. Este es el detalle:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin:8px 0 16px;">
      ${filas}
      <tr>
        <td style="padding:10px 0;font-weight:bold;color:#111827;">Total</td>
        <td style="padding:10px 0;text-align:right;font-weight:bold;color:#111827;white-space:nowrap;">S/ ${opts.total.toFixed(2)}</td>
      </tr>
    </table>
    ${boton(reservaUrl, "Agendar mi cita")}`;
  const textoItems = opts.items
    .map((it) => `- ${it.descripcion} × ${it.cantidad}: S/ ${(it.cantidad * it.precioUnitario).toFixed(2)}`)
    .join("\n");
  const bodyText = `Tu presupuesto "${opts.titulo}" fue aprobado.\n\n${textoItems}\nTotal: S/ ${opts.total.toFixed(2)}\n\nAgenda tu cita aquí: ${reservaUrl}`;
  const tpl = layout(opts.clinicaNombre, "Tu presupuesto fue aprobado", bodyHtml, bodyText);
  return {
    asunto: `Presupuesto aprobado — ${opts.titulo} | ${opts.clinicaNombre}`,
    html: tpl.html,
    texto: tpl.text,
  };
}

const ROL_LABEL: Record<StaffRole, string> = {
  owner: "Dueño/a",
  receptionist: "Recepción",
  assistant: "Asistente",
  doctor: "Odontólogo/a",
};

export async function enviarEmailInvitacion(opts: {
  to: string;
  invitadoPor: string;
  clinicaNombre: string;
  role: StaffRole;
  inviteUrl: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const bodyHtml = `
    <p>${opts.invitadoPor} te invitó a unirte a <strong>${opts.clinicaNombre}</strong> en Clinicflow con el rol de <strong>${ROL_LABEL[opts.role]}</strong>.</p>
    ${boton(opts.inviteUrl, "Aceptar invitación")}
    <p>El enlace vence en 7 días. Si no esperabas esta invitación, ignora este correo.</p>`;
  const tpl = layout(
    opts.clinicaNombre,
    `Te invitaron a ${opts.clinicaNombre}`,
    bodyHtml,
    `${opts.invitadoPor} te invitó a unirte a ${opts.clinicaNombre} en Clinicflow como ${ROL_LABEL[opts.role]}.\n\nAcepta la invitación aquí: ${opts.inviteUrl}\n\nEl enlace vence en 7 días.`,
  );
  const r = await sendMail({
    to: opts.to,
    subject: `Invitación a ${opts.clinicaNombre} (Clinicflow)`,
    html: tpl.html,
    text: tpl.text,
  });
  return r.ok ? { ok: true } : { ok: false, reason: r.reason };
}

export async function enviarEmailPasswordReset(opts: {
  to: string;
  nombre: string;
  resetUrl: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const bodyHtml = `
    <p>Hola ${opts.nombre}, recibimos una solicitud para restablecer tu contraseña de Clinicflow.</p>
    ${boton(opts.resetUrl, "Restablecer contraseña")}
    <p>El enlace vence en 1 hora. Si no fuiste tú, ignora este correo.</p>`;
  const tpl = layout(
    "Clinicflow",
    "Restablece tu contraseña",
    bodyHtml,
    `Hola ${opts.nombre},\n\nRestablece tu contraseña aquí: ${opts.resetUrl}\n\nEl enlace vence en 1 hora. Si no fuiste tú, ignora este correo.`,
  );
  const r = await sendMail({
    to: opts.to,
    subject: "Restablece tu contraseña — Clinicflow",
    html: tpl.html,
    text: tpl.text,
  });
  return r.ok ? { ok: true } : { ok: false, reason: r.reason };
}
