import { expect, test } from "@playwright/test";
import {
  OWNER_DEMO,
  cerrarBannerInstalacion,
  crearCitaUI,
  crearPacienteUI,
  esc,
  fechaLima,
  loginPorApi,
  navConsola,
} from "./helpers";

// Día de operación en el consultorio demo. El dueño (owner) hace lo que hace
// todos los días: recibe un paciente nuevo, agenda, lo atiende en sala de
// espera, registra historia clínica, cobra, emite comprobante y cierra caja.
//
// Este spec corre en PARALELO (proyecto `vivo`, 3 workers) Y en móvil
// (proyecto `movil-vivo`, Pixel 7). Se scopea por sufijo único para no
// chocar con otros specs ni con datos demo existentes. La sala de espera
// muestra solo las citas de HOY, por eso la cita se agenda para hoy.
test("día de operación owner: paciente → cita hoy → sala → ficha → pago → comprobante → cierre", async ({
  browser,
}) => {
  const suf =
    Date.now().toString(36) +
    Math.floor(Math.random() * 46656).toString(36).padStart(3, "0");
  const context = await browser.newContext();
  const token = await loginPorApi(OWNER_DEMO.email);
  await context.addCookies([{ name: "of_session", value: token, domain: "localhost", path: "/" }]);
  const page = await context.newPage();

  const nombrePaciente = `Paciente Vivo ${suf}`;
  const celular = `9${Date.now().toString().slice(-8)}`;
  const emailPaciente = `pac-${suf}@e2e.local`;
  const nombreEsc = esc(nombrePaciente);

  // Localiza la tarjeta kanban (div.bg-card) que contiene a este paciente.
  const tarjeta = page.locator(
    `xpath=//div[contains(@class,"bg-card")][.//span[normalize-space(text())="${nombreEsc}" or contains(text(),"${nombreEsc}")] or .//p[contains(text(),"${nombreEsc}")]]`,
  );

  // 1) Paciente nuevo.
  await crearPacienteUI(page, nombrePaciente, celular, emailPaciente);

  // En móvil el layout muestra el banner PWA (bottom sheet fixed) que tapa el
  // kanban; se descarta una vez por sesión.
  await cerrarBannerInstalacion(page);

  // 2) Cita para HOY (la sala de espera solo muestra las de hoy).
  const hoy = fechaLima(0);
  await navConsola(page, "Agenda del día");
  await expect(page.getByRole("heading", { level: 2, name: /Agenda/ })).toBeVisible();
  await crearCitaUI(page, { paciente: nombrePaciente, fecha: hoy });

  // 3) Sala de espera: avanzar la tarjeta (confirmada → en_espera → en_atencion → atendida).
  await navConsola(page, "Sala de espera");
  await expect(page.getByRole("heading", { level: 2, name: "Sala de espera" })).toBeVisible();
  await tarjeta.waitFor({ timeout: 30_000 });

  // Por llegar → En sala.
  await tarjeta.getByRole("button", { name: "Llegó" }).first().click();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(tarjeta.getByRole("button", { name: "Llamar" }).first()).toBeVisible({ timeout: 20_000 });

  // En sala → En atención.
  await tarjeta.getByRole("button", { name: "Llamar" }).first().click();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(tarjeta.getByRole("button", { name: "Finalizar" }).first()).toBeVisible({ timeout: 20_000 });

  // En atención → Atendida (sale del kanban).
  await tarjeta.getByRole("button", { name: "Finalizar" }).first().click();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(tarjeta).toHaveCount(0, { timeout: 30_000 });

  // 4) Ficha: nota clínica.
  await navConsola(page, "Pacientes");
  await page.getByText(nombrePaciente, { exact: true }).first().click();
  await expect(page.getByText(nombrePaciente, { exact: true }).first()).toBeVisible();

  await page.getByPlaceholder("Escribe una nota clínica…").fill(`Nota de prueba vivo ${suf}`);
  await page.getByRole("button", { name: "Añadir nota" }).click();
  await expect(page.getByText("Nota añadida")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(`Nota de prueba vivo ${suf}`)).toBeVisible();

  await expect(page.getByText("Odontograma")).toHaveCount(0);

  // 5) Pago en caja.
  await navConsola(page, "Caja del día");
  await expect(page.getByRole("heading", { level: 2, name: "Caja" })).toBeVisible();
  const referencia = `E2E-${suf}`;
  await page.locator("#pago-monto").fill("80");
  await page.locator("#pago-metodo").selectOption("efectivo");
  await page.locator("#pago-paciente").selectOption({ label: nombrePaciente });
  await page.locator("#pago-referencia").fill(referencia);
  await page.getByRole("button", { name: "Registrar pago" }).click();
  await expect(page.getByText("Pago de S/ 80")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("tr", { hasText: referencia })).toBeVisible();

  // 6) Comprobante manual contra ese pago.
  await navConsola(page, "Comprobantes");
  await expect(page.getByRole("heading", { level: 2, name: "Comprobantes" })).toBeVisible();
  await page.getByRole("button", { name: "Emitir comprobante" }).click();
  await expect(page.locator("#comp-pago")).toBeVisible();
  await page.locator("#comp-pago").selectOption({ index: 1 });
  // El diálogo se reabre por corrida: hay varios botones "Emitir" en la página
  // (uno por fila de comprobantes). Scope al form del diálogo abierto.
  const formComprobante = page.locator("form").filter({ has: page.locator("#comp-pago") });
  await formComprobante.getByRole("button", { name: "Emitir" }).click();
  await expect(page.getByText("Comprobante emitido")).toBeVisible({ timeout: 20_000 });

  await context.close();
});
