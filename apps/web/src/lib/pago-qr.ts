import QRCode from "qrcode";
import { randomHex } from "@/lib/audit";

export const REFERENCIA_QR_PREFIX = "QR:";

export function numeroYapePlin(): string | null {
  const n = process.env.YAPE_PLIN_NUMBER?.trim();
  return n && n.length > 0 ? n : null;
}

export function generarRefQR(): string {
  return randomHex(3).toUpperCase();
}

export function referenciaCuotaQR(ref: string, cuotaId: string): string {
  return `${REFERENCIA_QR_PREFIX}${ref}:${cuotaId}`;
}

export function parseReferenciaCuotaQR(
  referencia: string | null,
): { ref: string; cuotaId: string } | null {
  if (!referencia) return null;
  if (!referencia.startsWith(REFERENCIA_QR_PREFIX)) return null;
  const partes = referencia.slice(REFERENCIA_QR_PREFIX.length).split(":");
  if (partes.length !== 2) return null;
  const ref = partes[0];
  const cuotaId = partes[1];
  if (!ref || !cuotaId) return null;
  return { ref, cuotaId };
}

export function esReferenciaQR(referencia: string | null): boolean {
  return typeof referencia === "string" && referencia.startsWith(REFERENCIA_QR_PREFIX);
}

export function contenidoQrPago(opts: {
  clinica: string;
  monto: number;
  ref: string;
  numero: string | null;
}): string {
  const lineas = ["Paga con Yape o Plin"];
  if (opts.numero) lineas.push(`Número: ${opts.numero}`);
  lineas.push(`Clínica: ${opts.clinica}`);
  lineas.push(`Monto: S/ ${opts.monto.toFixed(2)}`);
  lineas.push(`Referencia: ${opts.ref}`);
  return lineas.join("\n");
}

export async function qrPagoBase64(contenido: string): Promise<string> {
  const buf = await QRCode.toBuffer(contenido, {
    type: "png",
    width: 280,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  return `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
}
