import { expect, test } from "@playwright/test";
import { USUARIOS, loginPorApi } from "./auth";

const ES_FICHA = /\/consola\/pacientes\/[0-9a-f-]+/;
const ES_LISTADO = /\/consola\/pacientes/;
const ES_AGENDA = /\/consola\/agenda/;

// Regresion v1.6.1: en Next 15.5 los <Link> que solo cambian searchParams
// (tabs de agenda, filtros de whatsapp, periodos del dashboard) no navegaban
// en modo SPA: la URL no cambiaba y no habia fetch de servidor. Los reemplazos
// usan router.push() en componentes cliente; aqui se ejercita el patron
// completo sin recargas ni pestañas nuevas.
test("navegacion SPA: agenda (tabs y flechas), whatsapp (filtros) y dashboard (periodos) con searchParams", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const token = await loginPorApi(USUARIOS.owner.email);
  await context.addCookies([{ name: "of_session", value: token, domain: "localhost", path: "/" }]);
  const page = await context.newPage();

  // --- Agenda: tabs Día/Semana/Mes ---
  await page.goto("/consola/agenda", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 2, name: "Agenda" })).toBeVisible();

  await page.getByRole("button", { name: "Semana", exact: true }).click();
  await expect(page).toHaveURL(/vista=semana/);
  await expect(page.getByText(/Semana del/)).toBeVisible();

  await page.getByRole("button", { name: "Mes", exact: true }).click();
  await expect(page).toHaveURL(/vista=mes/);
  await expect(page.getByText(/agosto 2026/)).toBeVisible();

  await page.getByRole("button", { name: "Día", exact: true }).click();
  await expect(page).toHaveURL(/vista=dia/);
  await expect(page.getByRole("heading", { level: 2, name: "Agenda" })).toBeVisible();

  // --- Agenda: celda de un día en la vista semana (era un <Link> roto) ---
  await page.getByRole("button", { name: "Semana", exact: true }).click();
  await expect(page).toHaveURL(/vista=semana/);
  await page.getByRole("button", { name: /^(Lun|Mar|Mié|Jue|Vie|Sáb|Dom) \d+$/i }).first().click();
  await expect(page).toHaveURL(/vista=dia&fecha=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole("heading", { level: 2, name: "Agenda" })).toBeVisible();

  // --- Agenda: flecha Siguiente cambia la fecha (SPA) ---
  const urlAntes = page.url();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page).not.toHaveURL(urlAntes);
  await expect(page).toHaveURL(/vista=dia&fecha=\d{4}-\d{2}-\d{2}/);

  // --- WhatsApp: filtros Todos/Entrantes/Salientes ---
  await page.goto("/consola/whatsapp", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 2, name: "WhatsApp" })).toBeVisible();

  await page.getByRole("button", { name: "Entrantes", exact: true }).click();
  await expect(page).toHaveURL(/direccion=in/);
  await expect(page.getByText("Entrante", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Salientes", exact: true }).click();
  await expect(page).toHaveURL(/direccion=out/);
  await expect(page.getByText("Saliente", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Todos", exact: true }).click();
  await expect(page).toHaveURL(/\/consola\/whatsapp$/);

  // --- Dashboard: periodos de dias ---
  await page.goto("/consola/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 2, name: "Ingresos" })).toBeVisible();

  await page.getByRole("button", { name: "7 días", exact: true }).click();
  await expect(page).toHaveURL(/dias=7/);
  await expect(page.getByText(/últimos 7 días/).first()).toBeVisible();

  await page.getByRole("button", { name: "30 días", exact: true }).click();
  await expect(page).toHaveURL(/dias=30/);
  await expect(page.getByText(/últimos 30 días/).first()).toBeVisible();

  await context.close();
});

function nombreDeLaTarjeta(page: import("@playwright/test").Page, indice: number) {
  return page
    .getByRole("link")
    .filter({ hasText: /visita|Sin citas/ })
    .nth(indice)
    .locator("p")
    .first()
    .innerText();
}

// Regresion del bug reportado en v1.5.0 (fixed v1.5.1): al ir a Pacientes y
// abrir la ficha de un paciente funcionaba la primera vez, pero al volver
// atras y hacer click en otra persona la navegacion SPA parecia no cargar
// (el service worker podia servir HTML cacheado con chunks viejos). Abrir en
// otra pestana si cargaba. Este spec ejerce el patron exacto sin recargas:
// listado -> click ficha -> atras -> click otra ficha -> nav entre modulos.
test("navegacion SPA: pacientes listado -> ficha -> atras -> otra ficha -> agenda", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const token = await loginPorApi(USUARIOS.owner.email);
  await context.addCookies([{ name: "of_session", value: token, domain: "localhost", path: "/" }]);
  const page = await context.newPage();

  await page.goto("/consola/pacientes", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 2, name: "Pacientes" })).toBeVisible();

  // Espera a que el listing real reemplace el skeleton (si aplica).
  await expect(page.getByRole("link").filter({ hasText: /visita|Sin citas/ }).first()).toBeVisible();
  const total = await page.getByRole("link").filter({ hasText: /visita|Sin citas/ }).count();
  expect(total).toBeGreaterThanOrEqual(2);

  const nombreTarjeta1 = await nombreDeLaTarjeta(page, 0);
  const nombreTarjeta2 = await nombreDeLaTarjeta(page, 1);

  // 1er click SPA: abre una ficha.
  await page.getByRole("link").filter({ hasText: /visita|Sin citas/ }).first().click();
  await expect(page).toHaveURL(ES_FICHA);
  await expect(page.getByText("Historial de citas")).toBeVisible();
  await expect(page.locator("h2").first()).toContainText(nombreTarjeta1.trim());

  // Atras al listado sin recarga.
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(ES_LISTADO);
  await expect(page.getByRole("heading", { level: 2, name: "Pacientes" })).toBeVisible();

  // 2do click SPA en otra ficha: aqui vivia el bug.
  await page
    .getByRole("link")
    .filter({ hasText: /visita|Sin citas/ })
    .nth(1)
    .click();
  await expect(page).toHaveURL(ES_FICHA);
  await expect(page.getByText("Historial de citas")).toBeVisible();
  await expect(page.locator("h2").first()).toContainText(nombreTarjeta2.trim());

  // Ida y vuelta repetida: no debe quedar atrapada en HTML viejo.
  await page.goBack();
  await expect(page.getByRole("heading", { level: 2, name: "Pacientes" })).toBeVisible();
  await page.getByRole("link").filter({ hasText: /visita|Sin citas/ }).first().click();
  await expect(page).toHaveURL(ES_FICHA);
  await expect(page.getByText("Historial de citas")).toBeVisible();

  // Navegacion SPA entre modulos desde la barra lateral.
  const sidebar = page.locator("aside");
  await sidebar.getByRole("link", { name: /Agenda/, exact: false }).first().click();
  await expect(page).toHaveURL(ES_AGENDA);
  await expect(page.getByRole("heading", { level: 2, name: /Agenda/ })).toBeVisible();
  await sidebar.getByRole("link", { name: "Pacientes", exact: false }).first().click();
  await expect(page).toHaveURL(ES_LISTADO);
  await expect(page.getByRole("heading", { level: 2, name: "Pacientes" })).toBeVisible();

  await context.close();
});

// El service worker no debe cachear HTML de navegaciones (era la causa raiz):
// la version instalada debe ser la que solo guarda offline.html en caché.
test("el service worker no guarda HTML de paginas en cache", async ({ browser, baseURL }) => {
  // 1) El SW registrado es la version fix (sw.js con CACHE_NAME v2 y sin cache.put en navigate).
  const swSrc = await (await fetch(`${baseURL}/sw.js`)).text();
  expect(swSrc).toContain("of-cache-v2");
  expect(swSrc).not.toMatch(/mode === "navigate"[\s\S]{0,200}cache\.put/);

  // 2) En un cliente real, tras visitar y recargar con el SW activo,
  // el cache no debe contener HTML de rutas de pagina.
  const context = await browser.newContext();
  const token = await loginPorApi(USUARIOS.owner.email);
  await context.addCookies([{ name: "of_session", value: token, domain: "localhost", path: "/" }]);
  const page = await context.newPage();

  await page.goto("/consola/pacientes", { waitUntil: "domcontentloaded" });
  // Esperar a que el SW quede activo controlando la pagina.
  await page.waitForFunction(
    () => "serviceWorker" in navigator && navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 20_000 },
  ).catch(async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => "serviceWorker" in navigator && navigator.serviceWorker.controller !== null,
      undefined,
      { timeout: 20_000 },
    );
  });

  const htmlEnCache = await page.evaluate(async () => {
    const keys = await caches.keys();
    for (const key of keys) {
      const cache = await caches.open(key);
      for (const req of await cache.keys()) {
        const url = new URL(req.url);
        const esHtmlDePagina =
          !url.pathname.startsWith("/_next/") &&
          !url.pathname.startsWith("/icons/") &&
          url.pathname !== "/offline.html" &&
          url.pathname !== "/" &&
          !/\.[a-z0-9]{2,}$/i.test(url.pathname);
        if (esHtmlDePagina) return true;
      }
    }
    return false;
  });
  expect(htmlEnCache).toBe(false);

  await context.close();
});
