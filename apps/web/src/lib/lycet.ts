const FE_URL_BETA = "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService";
const FE_URL_PRODUCCION = "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService";

export interface LycetEmpresaInput {
  ruc: string;
  usuarioSol: string;
  claveSol: string;
  certificadoPemBase64: string;
  ambiente: string;
}

export interface LycetAceptacion {
  aceptado: boolean;
  code: string | null;
  message: string | null;
  hash: string | null;
  xml: string | null;
  cdrZipBase64: string | null;
}

export function lycetUrl(): string {
  return process.env.LYCET_URL ?? "http://127.0.0.1:8091";
}

export function lycetToken(): string {
  return process.env.LYCET_TOKEN ?? "123456";
}

export function lycetConfigurado(): boolean {
  return Boolean(process.env.LYCET_URL);
}

export function lycetMensajeError(status: number, body: Record<string, unknown>): string {
  if (typeof body.message === "string" && body.message.length > 0) return body.message;
  if (typeof body.error === "string" && body.error.length > 0) return body.error;
  if (body.error && typeof body.error === "object") {
    const err = body.error as Record<string, unknown>;
    if (typeof err.message === "string") return err.message;
  }
  return `El sidecar Greenter respondió con estado ${status}.`;
}

async function lycetFetch(
  ruta: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const sep = ruta.includes("?") ? "&" : "?";
  const res = await fetch(`${lycetUrl()}${ruta}${sep}token=${encodeURIComponent(lycetToken())}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return { ok: res.ok, status: res.status, body };
}

export async function lycetGuardarEmpresa(input: LycetEmpresaInput) {
  return lycetFetch(`/api/v1/configuration/company/${encodeURIComponent(input.ruc)}`, {
    method: "PUT",
    body: JSON.stringify({
      SOL_USER: `${input.ruc}${input.usuarioSol}`,
      SOL_PASS: input.claveSol,
      certificate: input.certificadoPemBase64,
      FE_URL: input.ambiente === "produccion" ? FE_URL_PRODUCCION : FE_URL_BETA,
    }),
  });
}

export async function lycetEmitirComprobante(
  endpoint: "invoice" | "note",
  doc: Record<string, unknown>,
) {
  return lycetFetch(`/api/v1/${endpoint}/send`, {
    method: "POST",
    body: JSON.stringify(doc),
  });
}

export async function lycetEstadoBaja(ruc: string, ticket: string) {
  const q = new URLSearchParams({ ticket, ruc });
  return lycetFetch(`/api/v1/voided/status?${q.toString()}`);
}

export async function lycetEnviarBaja(doc: Record<string, unknown>) {
  return lycetFetch(`/api/v1/voided/send`, {
    method: "POST",
    body: JSON.stringify(doc),
  });
}

export interface LycetBajaResultado {
  ok: boolean;
  ticket: string | null;
  message: string | null;
}

export function lycetExtraerBaja(body: Record<string, unknown>): LycetBajaResultado {
  const sunat = (body?.sunatResponse ?? {}) as Record<string, unknown>;
  const ticket =
    typeof sunat.ticket === "string" && sunat.ticket.length > 0 ? sunat.ticket : null;
  let message: string | null = null;
  if (sunat.error && typeof sunat.error === "object") {
    const err = sunat.error as Record<string, unknown>;
    if (typeof err.message === "string") message = err.message;
    else if (typeof err.code !== "undefined") message = String(err.code);
  }
  return { ok: sunat.success === true && ticket !== null, ticket, message };
}

export async function lycetEstadoComprobante(
  ruc: string,
  tipo: string,
  serie: string,
  numero: string,
) {
  const q = new URLSearchParams({ tipo, serie, numero });
  if (ruc) q.set("ruc", ruc);
  return lycetFetch(`/api/v1/invoice/status?${q.toString()}`);
}

export async function lycetSubirLogo(ruc: string, logoBase64: string) {
  return lycetFetch(`/api/v1/configuration/company/${encodeURIComponent(ruc)}/logo`, {
    method: "PUT",
    body: JSON.stringify({ logo: logoBase64 }),
  });
}

export async function lycetEliminarLogo(ruc: string) {
  return lycetFetch(`/api/v1/configuration/company/${encodeURIComponent(ruc)}/logo`, {
    method: "DELETE",
  });
}

export interface LycetQrInput {
  ruc: string;
  tipo: string;
  serie: string;
  numero: string;
  emision: string;
  igv: number;
  total: number;
  clienteTipo: string;
  clienteNumero: string;
}

export interface LycetQrResultado {
  ok: boolean;
  status: number;
  svg: string | null;
  contentType: string | null;
}

export async function lycetQr(input: LycetQrInput): Promise<LycetQrResultado> {
  const res = await fetch(
    `${lycetUrl()}/api/v1/sale/qr?token=${encodeURIComponent(lycetToken())}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(30_000),
    },
  );
  const contentType = res.headers.get("content-type");
  const svg = res.ok ? await res.text() : null;
  return { ok: res.ok, status: res.status, svg, contentType };
}

export function lycetExtraerAceptacion(body: Record<string, unknown>): LycetAceptacion {
  const sunat = (body?.sunatResponse ?? {}) as Record<string, unknown>;
  const cdr = (sunat.cdrResponse ?? {}) as Record<string, unknown>;

  let code: string | null = null;
  if (typeof cdr.code === "string") code = cdr.code;
  else if (typeof cdr.code === "number" || typeof cdr.code === "boolean") code = String(cdr.code);
  const codeNum = code === null ? Number.NaN : Number(code);
  const aceptado = code === "0" || (Number.isFinite(codeNum) && codeNum >= 4000);

  let message: string | null = null;
  if (typeof cdr.description === "string" && cdr.description.length > 0) {
    message = cdr.description;
  } else if (typeof sunat.error === "string" && sunat.error.length > 0) {
    message = sunat.error;
  } else if (sunat.error && typeof sunat.error === "object") {
    const err = sunat.error as Record<string, unknown>;
    if (typeof err.message === "string") message = err.message;
    else if (typeof err.code !== "undefined") message = String(err.code);
  }
  if (Array.isArray(cdr.notes)) {
    const notas = cdr.notes
      .filter((n): n is string => typeof n === "string" && n.length > 0)
      .join(" | ");
    if (notas.length > 0) message = message ? `${message} — ${notas}` : notas;
  }

  const hash = typeof body?.hash === "string" ? body.hash : null;
  const xml = typeof body?.xml === "string" ? body.xml : null;
  const cdrZipBase64 = typeof sunat.cdrZip === "string" ? sunat.cdrZip : null;

  return { aceptado, code, message, hash, xml, cdrZipBase64 };
}
