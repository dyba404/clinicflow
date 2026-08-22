import { expect, test } from "@playwright/test";
import {
  FICHA_DEMO,
  celularUnico,
  coleccionarErrores,
  crearCitaUI,
  crearPacienteUI,
  esc,
  fechaLima,
  loginPorUI,
  nombreLink,
  navConsola,
} from "./helpers";

// Roles del equipo en paralelo (proyecto `vivo`, 3 workers). Cada rol hace su
// turno real por la UI: recepción agenda/recibe/cobra, doctor atiende la ficha,
// asistente mueve inventario. Además verifica el menú según permisos (RBAC).
// Datos únicos por sufijo para no chocar entre workers ni con la demo.

test.describe("roles del equipo (RBAC real por UI)", () => {
  test("recepción: agenda cita para hoy, la recibe en sala y cobra en caja", async ({
    browser,
  }) => {
    const suf =
      Date.now().toString(36) +
      Math.floor(Math.random() * 46656).toString(36).padStart(3, "0");
    const context = await browser.newContext();
    const page = await context.newPage();
    const errores = coleccionarErrores(page);

    await loginPorUI(page, "recepcion@demo.clinicflow.pe");

    // RBAC: ve Caja del día (payments.register) pero NO Ingresos ni Personal.
    const aside = page.locator("aside");
    await expect(aside.getByRole("link", { name: "Caja del día", exact: true })).toBeVisible();
    await expect(aside.getByRole("link", { name: "Ingresos", exact: true })).toHaveCount(0);
    await expect(aside.getByRole("link", { name: "Personal", exact: true })).toHaveCount(0);

    // Paciente nuevo.
    const nombrePaciente = `Recepcion ${suf}`;
    await crearPacienteUI(page, nombrePaciente, celularUnico());

  // Cita para HOY con Ecografía (grid de horarios distinto al de
  // Consulta general que usa 02-operacion: evita colisionar bajo 3 workers).
    const hoy = fechaLima(0);
    const nombreEsc = esc(nombrePaciente);
    const tarjeta = page.locator(
      `xpath=//div[contains(@class,"bg-card")][.//span[normalize-space(text())="${nombreEsc}" or contains(text(),"${nombreEsc}")] or .//p[contains(text(),"${nombreEsc}")]]`,
    );

    await navConsola(page, "Agenda del día");
    await expect(page.getByRole("heading", { level: 2, name: /Agenda/ })).toBeVisible();
    await crearCitaUI(page, { servicioIndex: 2, paciente: nombrePaciente, fecha: hoy });

    // Sala de espera: confirma la llegada del paciente (confirmada → en espera).
    await navConsola(page, "Sala de espera");
    await expect(page.getByRole("heading", { level: 2, name: "Sala de espera" })).toBeVisible();
    await tarjeta.waitFor({ timeout: 30_000 });
    await tarjeta.getByRole("button", { name: "Llegó" }).first().click();
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(tarjeta.getByRole("button", { name: "Llamar" }).first()).toBeVisible({
      timeout: 20_000,
    });

    // Caja: cobra el servicio en efectivo (Ecografía = S/ 90).
    await navConsola(page, "Caja del día");
    await expect(page.getByRole("heading", { level: 2, name: /Caja/ })).toBeVisible();
    await page.locator("#pago-monto").fill("90");
    await page.locator("#pago-metodo").selectOption("efectivo");
    await page.locator("#pago-paciente").selectOption({ label: nombrePaciente });
    await page.getByRole("button", { name: "Registrar pago" }).click();
    await expect(page.getByText("Pago de S/ 90")).toBeVisible({ timeout: 20_000 });

    await expect(errores).toEqual([]);
    await context.close();
  });

  test("doctor: mi agenda y nota clínica; sin caja ni ingresos", async ({
    browser,
  }) => {
    const suf =
      Date.now().toString(36) +
      Math.floor(Math.random() * 46656).toString(36).padStart(3, "0");
    const context = await browser.newContext();
    const page = await context.newPage();
    const errores = coleccionarErrores(page);

    await loginPorUI(page, "luis@demo.clinicflow.pe");

    // RBAC del doctor: Mi agenda (agenda.view_own) y Pacientes, sin sala/caja/ingresos.
    const aside = page.locator("aside");
    await expect(aside.getByRole("link", { name: nombreLink("Mi agenda") })).toBeVisible();
    await expect(aside.getByRole("link", { name: "Pacientes", exact: true })).toBeVisible();
    await expect(aside.getByRole("link", { name: "Sala de espera", exact: true })).toHaveCount(0);
    await expect(aside.getByRole("link", { name: "Caja del día", exact: true })).toHaveCount(0);
    await expect(aside.getByRole("link", { name: "Ingresos", exact: true })).toHaveCount(0);

    await navConsola(page, "Mi agenda");
    await expect(page.getByRole("heading", { level: 2, name: /agenda/i })).toBeVisible();

    // Ficha de paciente demo: nota clínica.
    await page.goto(`/consola/pacientes/${FICHA_DEMO}`, { waitUntil: "domcontentloaded" });
    const nota = `Nota de doctor ${suf}`;
    await page.getByPlaceholder("Escribe una nota clínica…").fill(nota);
    await page.getByRole("button", { name: "Añadir nota" }).click();
    await expect(page.getByText("Nota añadida")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(nota)).toBeVisible();

    await expect(page.getByText("Odontograma")).toHaveCount(0);

    await expect(errores).toEqual([]);
    await context.close();
  });

  test("asistente: movimiento de inventario (merma); sin caja ni ingresos", async ({
    browser,
  }) => {
    const suf =
      Date.now().toString(36) +
      Math.floor(Math.random() * 46656).toString(36).padStart(3, "0");
    const context = await browser.newContext();
    const page = await context.newPage();
    const errores = coleccionarErrores(page);

    await loginPorUI(page, "asistente@demo.clinicflow.pe");

    // RBAC del asistente: Inventario y Sala de espera, sin caja ni ingresos.
    const aside = page.locator("aside");
    await expect(aside.getByRole("link", { name: "Inventario", exact: true })).toBeVisible();
    await expect(aside.getByRole("link", { name: nombreLink("Sala de espera") })).toBeVisible();
    await expect(aside.getByRole("link", { name: "Caja del día", exact: true })).toHaveCount(0);
    await expect(aside.getByRole("link", { name: "Ingresos", exact: true })).toHaveCount(0);

    // Primer ítem del inventario: merma de 1 unidad. El nth(0) ("QA Guantes
    // Nitrilo") tiene stock 0 y la merma sería rechazada; usamos el segundo
    // ítem ("Guantes de nitrilo", 24 cajas) que sí tiene stock.
    await navConsola(page, "Inventario");
    await expect(page.getByRole("button", { name: "Movimiento" }).nth(1)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Movimiento" }).nth(1).click();

    const form = page.locator("form").filter({ hasText: "Tipo de movimiento" });
    await expect(form).toBeVisible({ timeout: 10_000 });
    await form.locator("select").first().selectOption("merma");
    await form.locator('input[type="number"]').fill("1");
    await form.getByPlaceholder("Motivo o referencia").fill(`merma E2E ${suf}`);
    await page.getByRole("button", { name: "Registrar" }).click();
    await expect(page.getByText("Movimiento registrado.")).toBeVisible({ timeout: 20_000 });

    await expect(errores).toEqual([]);
    await context.close();
  });
});