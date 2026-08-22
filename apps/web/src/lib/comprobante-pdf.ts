import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { attachmentsRoot } from "@/lib/attachments";

const TIPO_DOC_QR: Record<string, string> = {
  boleta: "03",
  factura: "01",
};

export function logoComprobantePath(tenantId: string): string {
  return join(attachmentsRoot(), "fiscal", tenantId, "logo.png");
}

export async function leerLogoComprobante(tenantId: string): Promise<Uint8Array | null> {
  try {
    const buf = await readFile(logoComprobantePath(tenantId));
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export function qrSunatContenido(opts: {
  tipo: string;
  ruc: string;
  serie: string;
  numero: string;
  igv: number;
  total: number;
  emision: Date | string;
  clienteTipo: string;
  clienteNumero: string;
}): string {
  const d = typeof opts.emision === "string" ? new Date(opts.emision) : opts.emision;
  const p: Record<string, string> = {};
  for (const q of new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d)) {
    p[q.type] = q.value;
  }
  const fecha = `${p.year}-${p.month}-${p.day}`;
  return [
    opts.ruc,
    TIPO_DOC_QR[opts.tipo] ?? "03",
    opts.serie,
    opts.numero,
    opts.igv.toFixed(2),
    opts.total.toFixed(2),
    fecha,
    opts.clienteTipo,
    opts.clienteNumero,
  ].join("|") + "|";
}

export async function generarQrPng(contenido: string): Promise<Uint8Array | null> {
  try {
    const buf = await QRCode.toBuffer(contenido, {
      type: "png",
      width: 240,
      margin: 2,
      errorCorrectionLevel: "Q",
    });
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export interface ComprobantePdfDatos {
  tipo: string;
  serie: string;
  correlativo: number;
  sunatEstado: string;
  sunatHash: string | null;
  emitidaAt: Date | string | null;
  createdAt: Date | string;
  monto: number;
  metodo: string;
  referencia: string | null;
  razonSocial: string;
  ruc: string | null;
  clienteNombre: string | null;
  clienteDocumento: string | null;
  afectadoNumero: string | null;
  bajaMotivo: string | null;
  teamName: string;
  timezone: string;
  qrPng: Uint8Array | null;
  qrContenido: string | null;
  logoPng: Uint8Array | null;
}

const TIPO_TITULO: Record<string, string> = {
  boleta: "BOLETA ELECTRÓNICA",
  factura: "FACTURA ELECTRÓNICA",
  nota_credito: "NOTA DE CRÉDITO",
  nota_debito: "NOTA DE DÉBITO",
};

const ESTADO_LABEL: Record<string, string> = {
  manual: "Manual",
  pendiente_envio: "Pendiente de envío",
  aceptado: "Aceptado por SUNAT",
  rechazado: "Rechazado por SUNAT",
  baja: "De baja",
  baja_pendiente: "Baja enviada",
  baja_aceptada: "Comprobante de baja (anulado)",
  baja_rechazada: "Baja rechazada",
};

const METODO_LABEL: Record<string, string> = {
  yape: "Yape",
  plin: "Plin",
  efectivo: "Efectivo",
  tarjeta_pos: "Tarjeta POS",
  tarjeta_online: "Tarjeta online",
  otro: "Otro",
};

function fechaTexto(d: Date | string, timezone: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(typeof d === "string" ? new Date(d) : d);
}

function soles(n: number): string {
  return `S/ ${n.toFixed(2)}`;
}

export async function generarPdfComprobante(d: ComprobantePdfDatos): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const teal = rgb(13 / 255, 148 / 255, 136 / 255);
  const gris = rgb(0.45, 0.45, 0.45);
  const negro = rgb(0, 0, 0);

  const numero = `${d.serie}-${String(d.correlativo).padStart(8, "0")}`;
  const titulo = TIPO_TITULO[d.tipo] ?? d.tipo.toUpperCase();
  const esNota = d.tipo === "nota_credito" || d.tipo === "nota_debito";
  const esAnulacion = d.sunatEstado === "baja_aceptada" || esNota;

  page.drawRectangle({ x: 0, y: 790, width: 595, height: 52, color: teal });
  let textoX = 48;
  const logoImg = d.logoPng ? await pdf.embedPng(d.logoPng).catch(() => null) : null;
  if (logoImg) {
    const h = 40;
    const w = h * (logoImg.width / logoImg.height);
    page.drawImage(logoImg, { x: 12, y: 796, width: Math.min(w, 110), height: h });
    textoX = Math.min(12 + w, 122) + 14;
  }
  page.drawText(d.teamName, { x: textoX, y: 814, size: 16, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Clinicflow · comprobante electrónico", { x: textoX, y: 798, size: 9, font, color: rgb(0.9, 1, 0.98) });
  page.drawText(titulo, { x: 420, y: 814, size: 11, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText(numero, { x: 420, y: 798, size: 10, font, color: rgb(1, 1, 1) });

  let y = 762;
  const linea = (texto: string, op?: { size?: number; bold?: boolean; color?: typeof negro }) => {
    page.drawText(texto, {
      x: 48,
      y,
      size: op?.size ?? 10,
      font: op?.bold ? fontBold : font,
      color: op?.color ?? negro,
    });
    y -= (op?.size ?? 10) + 6;
  };

  linea("Datos del emisor", { bold: true, color: teal });
  linea(d.razonSocial);
  if (d.ruc) linea(`RUC: ${d.ruc}`, { color: gris });
  y -= 6;

  linea("Cliente / receptor", { bold: true, color: teal });
  linea(d.clienteNombre ?? "Consumidor final");
  if (d.clienteDocumento) linea(`Documento: ${d.clienteDocumento}`, { color: gris });
  y -= 6;

  if (esNota && d.afectadoNumero) {
    linea("Comprobante modificado", { bold: true, color: teal });
    linea(d.afectadoNumero);
    if (d.bajaMotivo) linea(`Motivo: ${d.bajaMotivo}`, { color: gris });
    y -= 6;
  }

  linea("Concepto", { bold: true, color: teal });
  const concepto = esAnulacion
    ? `Anulación del comprobante ${d.afectadoNumero ?? numero}`
    : `Servicio clínico - ${numero}`;
  const maxChars = 92;
  if (concepto.length > maxChars) {
    for (let i = 0; i < concepto.length; i += maxChars) {
      linea(concepto.slice(i, i + maxChars));
    }
  } else {
    linea(concepto);
  }
  y -= 10;

  const monto = Math.round(d.monto * 100) / 100;
  const valor = Math.round((monto / 1.18) * 100) / 100;
  const igv = Math.round((monto - valor) * 100) / 100;

  page.drawLine({ start: { x: 48, y: y + 2 }, end: { x: 547, y: y + 2 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  y -= 12;
  const montoLinea = (label: string, val: string, bold = false) => {
    page.drawText(label, { x: 380, y, size: 10, font: bold ? fontBold : font, color: bold ? negro : gris });
    page.drawText(val, { x: 547 - font.widthOfTextAtSize(val, 10), y, size: 10, font: bold ? fontBold : font });
    y -= 16;
  };
  montoLinea("Valor venta", esAnulacion ? `(${soles(valor)})` : soles(valor));
  montoLinea("IGV (18%)", esAnulacion ? `(${soles(igv)})` : soles(igv));
  page.drawLine({ start: { x: 380, y: y + 4 }, end: { x: 547, y: y + 4 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  y -= 12;
  montoLinea("Importe total", esAnulacion ? `(${soles(monto)})` : soles(monto), true);
  y -= 20;

  linea("Estado SUNAT", { bold: true, color: teal });
  linea(ESTADO_LABEL[d.sunatEstado] ?? d.sunatEstado, { color: d.sunatEstado === "aceptado" ? teal : negro });
  if (d.emitidaAt) linea(`Emisión: ${fechaTexto(d.emitidaAt, d.timezone)}`, { color: gris });
  if (d.sunatHash) linea(`Hash CDR: ${d.sunatHash}`, { color: gris, size: 8 });
  linea(`Medio de pago: ${METODO_LABEL[d.metodo] ?? d.metodo}`, { color: gris });
  if (d.referencia) linea(`Referencia: ${d.referencia}`, { color: gris });
  if (d.sunatEstado === "baja_aceptada" && d.bajaMotivo && !esNota) {
    linea(`Dado de baja por: ${d.bajaMotivo}`, { color: gris });
  }

  const qrImg = d.qrPng ? await pdf.embedPng(d.qrPng).catch(() => null) : null;
  if (qrImg) {
    const lado = 90;
    page.drawImage(qrImg, { x: 457, y: 95, width: lado, height: lado });
    page.drawText("Escanea para verificar en SUNAT", {
      x: 457 + lado - font.widthOfTextAtSize("Escanea para verificar en SUNAT", 7),
      y: 83,
      size: 7,
      font,
      color: gris,
    });
    if (d.qrContenido) {
      page.drawText(d.qrContenido.slice(0, 130), {
        x: 48,
        y: 150,
        size: 6.5,
        font,
        color: gris,
        maxWidth: 380,
      });
    }
  }

  page.drawText(
    "Documento generado electrónicamente por Clinicflow. Válido para presentarlo ante SUNAT según su estado.",
    { x: 48, y: 52, size: 8, font, color: gris, maxWidth: 500 },
  );
  page.drawText(`Generado el ${fechaTexto(new Date(), d.timezone)}`, { x: 48, y: 38, size: 8, font, color: gris });

  return pdf.save();
}
