export interface WhatsAppSettingsLike {
  activo: boolean;
  phoneNumberId: string | null;
  tokenEnc: string | null;
}

export interface WhatsAppResultado {
  ok: boolean;
  wamid?: string;
  errorCode?: number;
  reason?: string;
}

export const CODIGOS_FUERA_ALCANCE = new Set([
  131031, 131047, 131049, 133000, 130472, 132000, 132015, 100,
]);

export function whatsAppUrl(phoneNumberId: string): string {
  return `${process.env.WHATSAPP_BASE_URL ?? "https://graph.facebook.com/v19.0"}/${phoneNumberId}/messages`;
}

export function whatsAppConfigurada(settings: WhatsAppSettingsLike | null | undefined): boolean {
  return Boolean(settings?.activo && settings.phoneNumberId && settings.tokenEnc);
}

export function normalizarCelularE164(celular: string | null | undefined): string | null {
  let digitos = (celular ?? "").replace(/\D/g, "");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.length === 9 && digitos.startsWith("9")) digitos = `51${digitos}`;
  if (digitos.length < 8) return null;
  return digitos;
}

async function parseErrorMeta(res: Response): Promise<{ errorCode?: number; reason?: string }> {
  const j = (await res.json().catch(() => null)) as {
    error?: { message?: string; code?: number };
  } | null;
  return {
    errorCode: j?.error?.code,
    reason: j?.error?.message ?? `http_${res.status}`,
  };
}

export async function enviarWhatsApp(
  to: string,
  token: string,
  phoneNumberId: string,
  body: string,
): Promise<WhatsAppResultado> {
  try {
    const res = await fetch(whatsAppUrl(phoneNumberId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        type: "text",
        to,
        text: { preview_url: false, body },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const { errorCode, reason } = await parseErrorMeta(res);
      return { ok: false, errorCode, reason };
    }
    const j = (await res.json().catch(() => null)) as {
      messages?: Array<{ id?: string }>;
    } | null;
    return { ok: true, wamid: j?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "error_whatsapp" };
  }
}

export async function enviarPlantillaWhatsApp(
  to: string,
  token: string,
  phoneNumberId: string,
  nombrePlantilla: string,
  idioma: string,
  parametros: string[],
): Promise<WhatsAppResultado> {
  const components =
    parametros.length > 0
      ? [
          {
            type: "body",
            parameters: parametros.map((text) => ({ type: "text", text })),
          },
        ]
      : undefined;
  try {
    const res = await fetch(whatsAppUrl(phoneNumberId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: nombrePlantilla,
          language: { code: idioma },
          ...(components ? { components } : {}),
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const { errorCode, reason } = await parseErrorMeta(res);
      return { ok: false, errorCode, reason };
    }
    const j = (await res.json().catch(() => null)) as {
      messages?: Array<{ id?: string }>;
    } | null;
    return { ok: true, wamid: j?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "error_whatsapp" };
  }
}
