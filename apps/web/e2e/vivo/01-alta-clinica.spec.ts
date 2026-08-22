import { expect, test } from "@playwright/test";
import { altaClinicaPorUI, sufijo, verificarEntorno } from "./helpers";

test.beforeAll(async () => {
  await verificarEntorno();
});

// Operación en vivo: una clínica nueva se da de alta y completa los primeros
// pasos tal como lo haría un dueño real el día 1. Todo por UI.
test("alta de clínica: signup → checklist primeros pasos se completa al avanzar", async ({
  browser,
}) => {
  const suf = sufijo();
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1) Alta completa por UI.
  const clinica = await altaClinicaPorUI(page, suf);

  // 2) Panel del owner: checklist "Primeros pasos" arranca en 0/5.
  await expect(page.getByText("Primeros pasos")).toBeVisible();
  await expect(page.getByText("0/5")).toBeVisible();
  await expect(page.getByText("Configura los datos de tu clínica")).toBeVisible();

  // Paso "legal": razón social + contacto ARCO completan el item.
  await page.goto("/consola/config/legal", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Razón social").fill(`${clinica.nombreClinica} S.A.C.`);
  await page.getByLabel("RUC").fill("20123456789");
  await page.getByLabel("Correo de contacto (Ley 29733)").fill(clinica.email);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Configuración legal guardada.")).toBeVisible();
  await expect(page.getByText("Datos legales completos")).toBeVisible();

  await page.goto("/consola", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("1/5")).toBeVisible();

  // Paso "servicios": crear un servicio.
  await page.goto("/consola/config/servicios", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Nuevo servicio" }).click();
  await page.getByLabel("Nombre").fill("Consulta general");
  await page.getByLabel("Precio (S/)").fill("80");
  await page.getByRole("button", { name: "Crear servicio" }).click();
  await expect(page.getByText("Servicio creado")).toBeVisible();

  await page.goto("/consola", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("2/5")).toBeVisible();

  // Paso "equipo": invitar a recepción marca el checklist aunque aún no acepte.
  await page.goto("/consola/personal", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Correo").fill(`recep-${suf}@equipo.local`);
  await page.getByLabel("Rol").selectOption("receptionist");
  await page.getByRole("button", { name: "Invitar" }).click();
  await expect(page.getByText(/Invitación enviada a|Invitación creada/)).toBeVisible();

  await page.goto("/consola", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("3/5")).toBeVisible();

  await context.close();
});

// El slug auto-generado y la página pública quedan operativos de inmediato.
test("alta de clínica: la página pública de reservas responde al slug nuevo", async ({
  browser,
}) => {
  const suf = sufijo();
  const context = await browser.newContext();
  const page = await context.newPage();
  const clinica = await altaClinicaPorUI(page, suf);

  // Reservar requiere servicios → crear uno primero.
  await page.goto("/consola/config/servicios", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Nuevo servicio" }).click();
  await page.getByLabel("Nombre").fill("Ecografía abdominal");
  await page.getByLabel("Precio (S/)").fill("150");
  await page.getByRole("button", { name: "Crear servicio" }).click();
  await expect(page.getByText("Servicio creado")).toBeVisible();

  // La página pública del nuevo slug carga el wizard con el servicio creado.
  await page.goto(`/${clinica.slug}/reserva`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 2, name: "¿Qué necesitas?" })).toBeVisible();
  await expect(page.getByText("Ecografía abdominal")).toBeVisible();

  await context.close();
});

// Rechazo de duplicados por UI (no debe romperse con clínicas existentes).
test("alta de clínica: slug duplicado se rechaza con mensaje claro", async ({
  browser,
}) => {
  const suf = sufijo();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Nombre del consultorio").fill("Clinica Duplicada X" + suf.slice(0, 4));
  await page.getByLabel("Dirección de tu página de reservas").fill("clinica-central"); // slug del tenant demo
  await page.getByLabel("Tu nombre").fill(`Dueño Dup ${suf}`);
  await page.getByLabel("Correo").fill(`dup-${suf}@e2e.local`);
  await page.getByLabel("Contraseña").fill("demo1234");
  await page.getByRole("button", { name: "Crear mi consultorio" }).click();

  await expect(page.getByText("Esa dirección web ya está en uso. Elige otra.")).toBeVisible();
  // No se creó sesión ni navegación.
  await expect(page).toHaveURL(/\/signup/);

  await context.close();
});
