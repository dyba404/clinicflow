import { expect, request, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

// Helpers de la suite de operación en vivo (v1.6.0). Todo es UI-first; la API
// solo se usa para login de staff (como haría un operador con sesión válida)
// y para leer Mailpit (bandeja local de correos dev).

export const BASE = "http://localhost:3112";
export const MAILS_API = "http://localhost:8025/api/v1";
export const WHATS_API = "http://localhost:3010";
export const CLINICA_DEMO = "clinica-central";
export const NOMBRE_CLINICA_DEMO = "Clínica Central";
export const PASSTAFF = "demo1234";
export const OWNER_DEMO = { email: "owner@demo.clinicflow.pe", password: "demo1234" };
export const FICHA_DEMO = "75f57945-8ad7-4649-b0dd-34aab7b0fdfd";

let contador = 0;

/** Sufijo único por worker/proceso: evita colisiones entre los 3 workers. */
export function sufijo(): string {
  contador++;
  return (
    Date.now().toString(36) +
    process.pid.toString(36) +
    contador.toString(36) +
    Math.floor(Math.random() * 46656).toString(36).padStart(3, "0")
  );
}

export function celularUnico(): string {
  return `9${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 10)}`;
}

export function emailUnico(prefijo: string, suf: string): string {
  return `${prefijo}-${suf}@e2e.clinicflow.local`;
}

/** Fecha en Lima (America/Lima) como YYYY-MM-DD, con offset en días. */
export function fechaLima(offsetDias = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(
    new Date(Date.now() + offsetDias * 86_400_000),
  );
}

export function esc(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Login de staff por API (la UI de login se prueba en resiliencia/429). */
export async function loginPorApi(email: string, password = PASSTAFF): Promise<string> {
  const ctx = await request.newContext();
  try {
    for (let intento = 0; intento < 3; intento++) {
      const res = await ctx.post(`${BASE}/api/auth/login`, {
        data: { email, password },
      });
      if (res.status() === 429) {
        const retryAfter = Math.min(Number(res.headers()["retry-after"] ?? "15"), 60);
        await new Promise((r) => setTimeout(r, retryAfter * 1000 + 500));
        continue;
      }
      if (!res.ok()) {
        throw new Error(`login falló (${email}): ${res.status()} ${await res.text()}`);
      }
      const setCookie = (await res.headersArray())
        .filter((h) => h.name.toLowerCase() === "set-cookie")
        .map((h) => h.value)
        .find((c) => c.startsWith("of_session="));
      if (!setCookie) throw new Error(`login sin cookie of_session (${email})`);
      return setCookie.split(";")[0]!.slice("of_session=".length);
    }
    throw new Error(`login agotó reintentos por rate limit (${email})`);
  } finally {
    await ctx.dispose();
  }
}

export async function contextoSesion(browser: Browser, email: string): Promise<BrowserContext> {
  const token = await loginPorApi(email);
  const context = await browser.newContext();
  await context.addCookies([{ name: "of_session", value: token, domain: "localhost", path: "/" }]);
  return context;
}

/** Login por la UI real (form de /login). Se prueba aquí; la API es solo para staff. */
export async function loginPorUI(page: Page, email: string, password = PASSTAFF) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/consola/, { timeout: 15_000 });
}

/** Colecciona pageerrors y console.error de una página para afirmar al final. */
export function coleccionarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errores.push(`console.error: ${m.text()}`);
  });
  return errores;
}

export function filtrarRuidoRed(errores: string[]): string[] {
  return errores.filter(
    (e) =>
      !/net::|ERR_|Failed to load resource|offline|RSC payload|Falling back to browser navigation/i.test(
        e,
      ),
  );
}

// ---------- Docker (vía WSL) para cortes de BD controlados ----------

export function dockerCmd(...args: string[]): string {
  try {
    return execFileSync(
      "wsl.exe",
      ["-d", "Ubuntu", "-u", "dev", "--", "sudo", "docker", ...args],
      { encoding: "utf8", timeout: 90_000, windowsHide: true },
    ).trim();
  } catch (e) {
    const stderr = (e as { stderr?: Buffer }).stderr?.toString() ?? String(e);
    throw new Error(`docker ${args.join(" ")} falló: ${stderr.slice(0, 500)}`);
  }
}

export function pausarBD() {
  dockerCmd("pause", "clinicflow-db");
}

export function reanudarBD() {
  dockerCmd("unpause", "clinicflow-db");
}

/** Espera a que el server reporte salud (db=true) tras un corte de BD. */
export async function esperarHealth(timeoutMs = 60_000): Promise<void> {
  const limite = Date.now() + timeoutMs;
  let ultimo = "";
  while (Date.now() < limite) {
    const r = await fetch(`${BASE}/api/health`).catch(() => null);
    if (r && r.ok) {
      const j = (await r.json()) as { checks?: { db?: boolean } };
      if (j.checks?.db) return;
      ultimo = `db=${String(j.checks?.db)}`;
    } else {
      ultimo = `status ${r?.status ?? "sin respuesta"}`;
    }
    await new Promise((x) => setTimeout(x, 700));
  }
  throw new Error(`el server no recuperó salud DB: ${ultimo}`);
}

/** Verifica el entorno antes de correr; si falta algo hace skip (no falso positivo). */
export async function verificarEntorno(): Promise<{ mailpit: boolean }> {
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health || !health.ok) {
    throw new Error(`Servidor caído en ${BASE} — ejecutar scripts/serve-console.ps1 y scripts/of.ps1 up`);
  }
  const h = (await health.json()) as { checks: { db: boolean } };
  if (!h.checks.db) throw new Error("Postgres caído — ejecutar scripts/of.ps1 up");
  let mailpit = false;
  try {
    const m = await fetch(`${MAILS_API}/messages`);
    mailpit = m.ok;
  } catch {
    mailpit = false;
  }
  return { mailpit };
}

// ---------- Mailpit (bandeja local de correos dev) ----------

interface CorreoResumen {
  id: string;
  subject: string;
}

export async function buscarCorreos(paraEmail: string): Promise<CorreoResumen[]> {
  const url = `${MAILS_API}/search?query=${encodeURIComponent(`to:"${paraEmail}"`)}&limit=100`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const j = (await res.json()) as {
    messages?: Array<{ ID: string; Subject: string }>;
  };
  return (j.messages ?? []).map((m) => ({ id: m.ID, subject: m.Subject }));
}

export async function cuerpoCorreo(id: string): Promise<{ html: string; text: string }> {
  const res = await fetch(`${MAILS_API}/message/${id}`);
  const j = (await res.json()) as { HTML?: string; Text?: string };
  return { html: j.HTML ?? "", text: j.Text ?? "" };
}

/**
 * Espera hasta encontrar un correo para `paraEmail` cuyo asunto coincida.
 * Devuelve el primer (más reciente) match con su cuerpo.
 */
export async function esperarCorreo(
  paraEmail: string,
  asunto: RegExp,
  timeoutMs = 20_000,
): Promise<{ id: string; subject: string; html: string; text: string }> {
  const limite = Date.now() + timeoutMs;
  let ultimoError = "";
  while (Date.now() < limite) {
    const lista = await buscarCorreos(paraEmail);
    const match = lista.find((c) => asunto.test(c.subject));
    if (match) {
      const cuerpo = await cuerpoCorreo(match.id);
      return { ...match, ...cuerpo };
    }
    ultimoError = `sin correo /${asunto.source}/ para ${paraEmail} (vistos ${lista.length})`;
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error(ultimoError);
}

export function extraerUrl(contenido: string, patron: RegExp): string {
  const m = contenido.match(patron);
  if (!m) throw new Error(`URL no encontrada con patrón ${patron} en el correo`);
  return m[1].replace(/&amp;/g, "&");
}

// ---------- Alta de clínica vía UI ----------

export async function altaClinicaPorUI(page: Page, suf: string) {
  const nombreClinica = `Clinica E2E ${suf}`.slice(0, 60);
  const slug = `e2e-${suf}`;
  const email = emailUnico("owner", suf);
  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Nombre del consultorio").fill(nombreClinica);
  await page.getByLabel("Dirección de tu página de reservas").fill(slug);
  await page.getByLabel("Tu nombre").fill(`Dueña E2E ${suf}`.slice(0, 60));
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(PASSTAFF);
  await page.getByRole("button", { name: "Crear mi consultorio" }).click();
  await expect(page).toHaveURL(/\/consola/, { timeout: 30_000 });
  return { nombreClinica, slug, email, nombreDueno: `Dueña E2E ${suf}` };
}

// ---------- Navegación en la consola (sidebar desktop o nav móvil) ----------

/** Nombre accesible de un link del sidebar, tolerando el badge: "Agenda del día 10" (desktop) o "Agenda del día (10)" (móvil). */
export function nombreLink(etiqueta: string): RegExp {
  return new RegExp(`^${esc(etiqueta)}(\\s+\\(\\d+\\))?(\\s+\\d+)?$`);
}

export async function navConsola(page: Page, etiqueta: string) {
  const aside = page.locator("aside");
  if (await aside.isVisible().catch(() => false)) {
    // Abre grupos colapsables (Negocios / Configuración): sus links quedan
    // visibles pero tapados si el grupo está cerrado.
    for (const toggle of await aside.locator("button[aria-expanded]").all()) {
      if ((await toggle.getAttribute("aria-expanded")) === "false") {
        await toggle.click();
      }
    }
    await aside.getByRole("link", { name: nombreLink(etiqueta) }).first().click();
  } else {
    await page
      .locator("nav")
      .getByRole("link", { name: nombreLink(etiqueta) })
      .first()
      .click();
  }
}

/**
 * Descarta el banner PWA ("Instala Clinicflow en tu celular") que el layout
 * muestra en móvil (pointer: coarse). Es un bottom sheet fixed que puede
 * tapar botones del kanban; se cierra una vez y queda en localStorage.
 */
export async function cerrarBannerInstalacion(page: Page) {
  const banner = page.getByText("Instala Clinicflow en tu celular");
  if (!(await banner.isVisible().catch(() => false))) return;
  await banner
    .locator("xpath=ancestor::div[contains(@class,'fixed')]")
    .getByRole("button", { name: "Cerrar" })
    .click();
  await banner.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
}

/** Crea un paciente por UI desde /consola/pacientes. */
export async function crearPacienteUI(page: Page, nombre: string, celular: string, email?: string) {
  await page.goto("/consola/pacientes", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.getByLabel("Nombre completo").fill(nombre);
  await page.getByLabel("Celular").fill(celular);
  if (email) {
    await page.getByLabel("Email").fill(email);
  }
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByText(`Paciente creado: ${nombre}`)).toBeVisible({ timeout: 15_000 });
}

/**
 * Agenda una cita por UI desde /consola/agenda. Bajo saturación real (3
 * workers) dos staff pueden pedir el mismo horario; si el server lo rechaza
 * por estar ocupado, reintenta con el siguiente horario libre (como haría un
 * humano). Requiere estar ya en /consola/agenda.
 */
export async function crearCitaUI(
  page: Page,
  opts: { servicioIndex?: number; paciente: string; fecha: string },
) {
  const servicioIndex = opts.servicioIndex ?? 1;
  for (let intento = 0; intento < 3; intento++) {
    await page.getByRole("button", { name: "Nueva cita" }).click();
    await page.locator("#cita-servicio").selectOption({ index: servicioIndex });
    await page.locator("#cita-paciente").selectOption({ label: opts.paciente });
    await page.locator("#cita-fecha").fill(opts.fecha);
    await expect
      .poll(async () => page.locator("#cita-hora option").count(), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(2);
    await page.locator("#cita-hora").selectOption({ index: 1 + intento });
    await page.getByRole("button", { name: "Crear cita" }).click();
    const ok = await page
      .getByText("Cita creada")
      .isVisible({ timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    if (ok) return;
    if (!(await page.getByText("El horario elegido está ocupado").isVisible().catch(() => false))) {
      await expect(page.getByText("Cita creada")).toBeVisible({ timeout: 20_000 });
    }
    await page.getByRole("button", { name: "Cancelar" }).click();
  }
  throw new Error(`no se pudo crear la cita de ${opts.paciente} tras 3 intentos (horarios ocupados)`);
}
