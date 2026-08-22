import { expect, test } from "@playwright/test";
import {
  CLINICA_DEMO,
  emailUnico,
  esperarCorreo,
  extraerUrl,
  fechaLima,
  loginPorApi,
  sufijo,
} from "./helpers";

// Ciclo del paciente público: reserva desde la página pública de la clínica
// (/clinica-central/reserva), la recepción (owner) la confirma desde Solicitudes, el
// paciente recibe el correo y desde su enlace personal reprograma y cancela.
// Todo por UI; solo se usa la API para abrir la sesión del staff.

test("paciente público: reserva → confirmación → correo → reprogramar → cancelar", async ({
  browser,
}) => {
  const suf = sufijo();
  const nombre = `Paciente Publico ${suf}`;
  const celular = `9${Date.now().toString().slice(-8)}`;
  const email = emailUnico("publico", suf);

  // 1) Reserva pública por el wizard.
  const contextoPublico = await browser.newContext();
  const pagePub = await contextoPublico.newPage();
  await pagePub.goto(`/${CLINICA_DEMO}/reserva`, { waitUntil: "domcontentloaded" });

  await pagePub.getByRole("button", { name: /Consulta general/ }).first().click();
  await pagePub.locator("#fecha").fill(fechaLima(1));
  await pagePub.getByRole("button", { name: "Ver horarios disponibles" }).click();
  await expect
    .poll(
      async () => pagePub.locator("button").filter({ hasText: /^\d{2}:\d{2}$/ }).count(),
      { timeout: 20_000 },
    )
    .toBeGreaterThanOrEqual(1);
  await pagePub.locator("button").filter({ hasText: /^\d{2}:\d{2}$/ }).first().click();
  await pagePub.getByRole("button", { name: "Continuar" }).click();

  await pagePub.locator("#nombre").fill(nombre);
  await pagePub.locator("#celular").fill(celular);
  await pagePub.locator("#email").fill(email);
  await pagePub.getByRole("checkbox").check();
  await pagePub.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(pagePub.getByRole("heading", { name: "¡Solicitud enviada!" })).toBeVisible({
    timeout: 20_000,
  });
  await contextoPublico.close();

  // 2) La dueña confirma la solicitud desde la consola.
  const contextoOwner = await browser.newContext();
  const token = await loginPorApi("owner@demo.clinicflow.pe");
  await contextoOwner.addCookies([
    { name: "of_session", value: token, domain: "localhost", path: "/" },
  ]);
  const pageOwner = await contextoOwner.newPage();
  await pageOwner.goto("/consola/solicitudes", { waitUntil: "domcontentloaded" });
  const fila = pageOwner.locator("tr").filter({ hasText: nombre });
  await fila.waitFor({ timeout: 30_000 });
  await fila.getByRole("button", { name: "Confirmar" }).click();
  await expect(pageOwner.getByText(`Cita de ${nombre} confirmada`)).toBeVisible({
    timeout: 20_000,
  });

  // 3) Llega el correo de confirmación con el enlace personal de gestión.
  const correo = await esperarCorreo(email, /Cita confirmada —/);
  const gestionarUrl = extraerUrl(correo.text, /(https?:\/\/[^\s]+?\/gestionar\/[^\s]+)/);
  expect(gestionarUrl).toContain(`/${CLINICA_DEMO}/gestionar/`);

  // 4) El paciente abre su enlace (sin sesión) y reprograma.
  const contextoPaciente = await browser.newContext();
  const page = await contextoPaciente.newPage();
  await page.goto(gestionarUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Gestiona tu cita")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(nombre)).toBeVisible();

  await page.getByRole("button", { name: "Reprogramar" }).click();
  await expect(page.getByRole("heading", { name: "Nueva fecha y hora" })).toBeVisible();

  async function elegirSlot(fecha: string) {
    await page.locator("#g-fecha").fill(fecha);
    await page.getByRole("button", { name: "Ver horarios disponibles" }).click();
    await expect
      .poll(
        async () =>
          page.locator("button").filter({ hasText: /^\d{2}:\d{2}$/ }).count(),
        { timeout: 20_000 },
      )
      .toBeGreaterThanOrEqual(1);
    await page.locator("button").filter({ hasText: /^\d{2}:\d{2}$/ }).first().click();
  }
  await elegirSlot(fechaLima(2));
  await page.getByRole("button", { name: "Confirmar reprogramación" }).click();
  await expect(page.getByText("Cita reprogramada con éxito.")).toBeVisible({ timeout: 20_000 });

  // 5) Y cancela la cita.
  await page.getByRole("button", { name: "Cancelar cita" }).click();
  await page.getByRole("button", { name: "Sí, cancelar mi cita" }).click();
  await expect(page.getByText("Cita cancelada.")).toBeVisible({ timeout: 20_000 });

  await contextoPaciente.close();
  await contextoOwner.close();
});