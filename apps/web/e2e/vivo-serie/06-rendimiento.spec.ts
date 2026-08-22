import { expect, test } from "@playwright/test";
import {
  OWNER_DEMO,
  coleccionarErrores,
  contextoSesion,
  filtrarRuidoRed,
} from "../vivo/helpers";

// Barrido de rendimiento en vivo (proyecto `vivo-serie`, un solo worker).
// Mide el tiempo de cada ruta principal con el server ya caliente y falla solo
// si una ruta tarda >10s, queda en blanco o lanza errores de página.

const RUTAS_PUBLICAS: string[] = ["/", "/login", "/clinica-central/reserva"];

const RUTAS_CONSOLE: string[] = [
  "/consola",
  "/consola/agenda",
  "/consola/sala-espera",
  "/consola/solicitudes",
  "/consola/pacientes",
  "/consola/caja",
  "/consola/dashboard",
  "/consola/inventario",
  "/consola/lista-espera",
  "/consola/personal",
  "/consola/caja/comprobantes",
  "/consola/presupuestos",
  "/consola/recall",
  "/consola/auditoria",
  "/consola/guia",
];

const MAX_MS = 10_000;

test("barrido de rendimiento: rutas principales cargan rápido y sin errores", async ({
  browser,
}) => {
  const resultados: Array<{ ruta: string; ms: number; chars: number }> = [];
  const fallos: string[] = [];

  // Rutas públicas (sin sesión).
  const ctxPublico = await browser.newContext();
  const pagePub = await ctxPublico.newPage();
  const erroresPub = coleccionarErrores(pagePub);
  for (const ruta of RUTAS_PUBLICAS) {
    const t0 = Date.now();
    try {
      await pagePub.goto(ruta, { waitUntil: "domcontentloaded" });
      const ms = Date.now() - t0;
      const cuerpo = (await pagePub.locator("body").innerText()).trim();
      resultados.push({ ruta, ms, chars: cuerpo.length });
      if (cuerpo.length < 40) fallos.push(`${ruta}: página casi en blanco (${cuerpo.length} chars)`);
      if (ms > MAX_MS) fallos.push(`${ruta}: tardó ${ms}ms`);
    } catch (e) {
      resultados.push({ ruta, ms: -1, chars: 0 });
      fallos.push(`${ruta}: ${String(e).slice(0, 300)}`);
    }
  }
  await expect(filtrarRuidoRed(erroresPub)).toEqual([]);
  await ctxPublico.close();

  // Rutas de la consola (sesión owner).
  const ctx = await contextoSesion(browser, OWNER_DEMO.email);
  const page = await ctx.newPage();
  const errores = coleccionarErrores(page);
  for (const ruta of RUTAS_CONSOLE) {
    const t0 = Date.now();
    try {
      await page.goto(ruta, { waitUntil: "domcontentloaded" });
      const ms = Date.now() - t0;
      const cuerpo = (await page.locator("body").innerText()).trim();
      resultados.push({ ruta, ms, chars: cuerpo.length });
      if (cuerpo.length < 40) fallos.push(`${ruta}: página casi en blanco (${cuerpo.length} chars)`);
      if (ms > MAX_MS) fallos.push(`${ruta}: tardó ${ms}ms`);
    } catch (e) {
      resultados.push({ ruta, ms: -1, chars: 0 });
      fallos.push(`${ruta}: ${String(e).slice(0, 300)}`);
    }
  }
  await expect(filtrarRuidoRed(errores)).toEqual([]);
  await ctx.close();

  resultados.sort((a, b) => b.ms - a.ms);
  console.log("=== Barrido de rendimiento (ms) ===");
  console.table(resultados);
  expect(fallos, fallos.join("\n")).toEqual([]);
});