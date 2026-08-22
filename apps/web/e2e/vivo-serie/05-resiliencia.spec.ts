import { expect, test } from "@playwright/test";
import {
  BASE,
  NOMBRE_CLINICA_DEMO,
  OWNER_DEMO,
  celularUnico,
  coleccionarErrores,
  contextoSesion,
  esperarHealth,
  fechaLima,
  filtrarRuidoRed,
  pausarBD,
  reanudarBD,
  sufijo,
} from "../vivo/helpers";

// Serie de resiliencia (proyecto `vivo-serie`, un solo worker). Correr SOLA:
// la pausa de Postgres y el quemado del rate limit de login afectan a todo el
// server, por eso estos tests son seriales y van después de los de operación.
// Orden dentro del archivo es importante: el 429 va al FINAL.

test.describe.configure({ mode: "serial" });

test("offline: el service worker muestra la pantalla sin conexión y se recupera", async ({
  browser,
}) => {
  const context = await contextoSesion(browser, OWNER_DEMO.email);
  const page = await context.newPage();
  const errores = coleccionarErrores(page);

  await page.goto("/consola/pacientes", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible();
  await page.waitForFunction(
    () => navigator.serviceWorker?.controller != null,
    undefined,
    { timeout: 20_000 },
  );

  await context.setOffline(true);
  await page.goto("/consola/agenda", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Estás sin conexión" })).toBeVisible({
    timeout: 15_000,
  });

  await context.setOffline(false);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 2, name: /Agenda/ })).toBeVisible({
    timeout: 30_000,
  });

  await expect(filtrarRuidoRed(errores)).toEqual([]);
  await context.close();
});

test("contienda: dos staff piden el mismo horario; solo el primero gana", async ({
  browser,
}) => {
  const hoy = fechaLima(0);
  const suf = sufijo();
  const nombreA = `Contienda A ${suf}`;
  const nombreB = `Contienda B ${suf}`;

  const ctxA = await contextoSesion(browser, OWNER_DEMO.email);
  const ctxB = await contextoSesion(browser, "recepcion@demo.clinicflow.pe");
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  // B abre el diálogo y deja la lista de horarios cargada (lista "stale").
  await pageB.goto("/consola/agenda", { waitUntil: "domcontentloaded" });
  await pageB.getByRole("button", { name: "Nueva cita" }).click();
  await pageB.locator("#cita-servicio").selectOption({ index: 1 });
  await pageB.locator("#cita-fecha").fill(hoy);
  await expect
    .poll(async () => pageB.locator("#cita-hora option").count(), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(2);

  // A agenda la misma hora en paralelo (lista fresca) y gana el slot.
  await pageA.goto("/consola/agenda", { waitUntil: "domcontentloaded" });
  await pageA.getByRole("button", { name: "Nueva cita" }).click();
  await pageA.locator("#cita-servicio").selectOption({ index: 1 });
  await pageA.locator("#cita-paciente").selectOption({ value: "__nuevo__" });
  await pageA.locator("#cita-nombre").fill(nombreA);
  await pageA.locator("#cita-celular").fill(celularUnico());
  await pageA.locator("#cita-fecha").fill(hoy);
  await expect
    .poll(async () => pageA.locator("#cita-hora option").count(), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(2);
  await pageA.locator("#cita-hora").selectOption({ index: 1 });
  await pageA.getByRole("button", { name: "Crear cita" }).click();
  await expect(pageA.getByText("Cita creada")).toBeVisible({ timeout: 20_000 });

  // B intenta el MISMO horario con su lista vieja: el server debe rechazarlo.
  await pageB.locator("#cita-paciente").selectOption({ value: "__nuevo__" });
  await pageB.locator("#cita-nombre").fill(nombreB);
  await pageB.locator("#cita-celular").fill(celularUnico());
  await pageB.locator("#cita-hora").selectOption({ index: 1 });
  await pageB.getByRole("button", { name: "Crear cita" }).click();
  await expect(pageB.getByText("El horario elegido está ocupado")).toBeVisible({
    timeout: 20_000,
  });

  await ctxA.close();
  await ctxB.close();
});

test("doble-click en «Crear paciente» no duplica al paciente", async ({ browser }) => {
  const suf = sufijo();
  const nombre = `Doble Click ${suf}`;
  const context = await contextoSesion(browser, OWNER_DEMO.email);
  const page = await context.newPage();

  await page.goto("/consola/pacientes", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.getByLabel("Nombre completo").fill(nombre);
  await page.getByLabel("Celular").fill(celularUnico());
  const btn = page.getByRole("button", { name: "Crear paciente" });
  await Promise.allSettled([btn.click({ force: true }), btn.click({ force: true })]);

  await expect(page.getByText(`Paciente creado: ${nombre}`)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(nombre, { exact: true })).toHaveCount(1, { timeout: 15_000 });
  await context.close();
});

test("corte de BD: skeleton (no pantalla blanca) y recuperación al reanudar", async ({
  browser,
}) => {
  const context = await contextoSesion(browser, OWNER_DEMO.email);
  const page = await context.newPage();

  await page.goto("/consola/pacientes", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible();

  pausarBD();
  try {
    // Navegación SPA a la ficha: el RSC queda colgado → skeleton persistente.
    await page.locator('a[href^="/consola/pacientes/"]').first().click();
    await expect(
      page
        .locator('[aria-label="Cargando ficha del paciente"]')
        .or(page.getByText("La base de datos tardó en despertar")),
    ).toBeVisible({ timeout: 15_000 });
    // El shell de la consola sigue visible: no es una pantalla blanca.
    await expect(page.getByText(NOMBRE_CLINICA_DEMO).first()).toBeVisible();
  } finally {
    reanudarBD();
    await esperarHealth();
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Historial de citas")).toBeVisible({ timeout: 60_000 });
  await context.close();
});

test("rate limit: tras quemar el bucket, el login UI avisa amablemente", async ({
  request,
  browser,
}) => {
  // Quema el bucket de login (10/min por IP local compartida).
  let estado = 0;
  for (let i = 0; i < 25 && estado !== 429; i++) {
    const r = await request.post(`${BASE}/api/auth/login`, {
      data: { email: OWNER_DEMO.email, password: "equivocada" },
    });
    estado = r.status();
  }
  expect(estado).toBe(429);

  // La UI debe avisar sin romperse y quedarse en /login.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").fill(OWNER_DEMO.email);
  await page.locator("#login-password").fill(OWNER_DEMO.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByText("No se pudo iniciar sesión")).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/login/);
  await context.close();
});