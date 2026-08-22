import { expect, test } from "@playwright/test";
import { USUARIOS, loginPorApi } from "./auth";

function mananaLima(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d);
}

// Flujo transversal (owner): paciente → cita → transición de estados →
// pago → verificación en Caja → anulación del pago.
test("flujo transversal: cita, estados, pago, caja y anulación", async ({ browser }) => {
  const suffix = Date.now();
  const token = await loginPorApi(USUARIOS.owner.email);
  const context = await browser.newContext();
  await context.addCookies([
    { name: "of_session", value: token, domain: "localhost", path: "/" },
  ]);
  const page = await context.newPage();
  const api = context.request;

  const svcRes = await api.get("/api/servicios");
  expect(svcRes.ok()).toBeTruthy();
  const { servicios } = (await svcRes.json()) as {
    servicios: Array<{ id: string; nombre: string }>;
  };
  const servicio =
    servicios.find((s) => s.nombre === "Consulta general") ?? servicios[0];
  expect(servicio).toBeTruthy();

  const nombrePaciente = `Paciente E2E ${suffix}`;
  const celular = `9${String(suffix).slice(-8)}`;
  const patRes = await api.post("/api/pacientes", {
    data: { nombre: nombrePaciente, celular },
  });
  expect(patRes.status()).toBe(201);
  const { paciente } = (await patRes.json()) as { paciente: { id: string } };

  const citaRes = await api.post("/api/citas", {
    data: {
      serviceId: servicio!.id,
      fecha: mananaLima(),
      horaIni: "12:30",
      paciente: { id: paciente.id },
    },
  });
  expect(citaRes.status()).toBe(201);
  const { id: citaId } = (await citaRes.json()) as { id: string };

  // confirmada → en_espera → en_atencion → atendida (máquina de estados)
  for (const estado of ["en_espera", "en_atencion", "atendida"]) {
    const r = await api.post(`/api/citas/${citaId}/estado`, { data: { estado } });
    expect(r.ok(), `transición a ${estado}: ${r.status()} ${await r.text()}`).toBeTruthy();
  }
  const estadoFinal = await api.post(`/api/citas/${citaId}/estado`, {
    data: { estado: "atendida" },
  });
  expect(estadoFinal.status()).toBe(409);

  const referencia = `E2E-${suffix}`;
  const pagoRes = await api.post("/api/caja/pagos", {
    data: {
      monto: 80,
      metodo: "efectivo",
      patientId: paciente.id,
      appointmentId: citaId,
      referencia,
    },
  });
  expect(pagoRes.status()).toBe(201);
  const { id: pagoId } = (await pagoRes.json()) as { id: string };

  await page.goto("/consola/caja", { waitUntil: "domcontentloaded" });
  const filaPago = page.locator("tr", { hasText: referencia });
  await expect(filaPago).toBeVisible();
  await expect(filaPago.getByText(nombrePaciente)).toBeVisible();

  const anularRes = await api.post(`/api/caja/pagos/${pagoId}/anular`, {
    data: { motivo: "Anulado por test e2e" },
  });
  expect(anularRes.ok()).toBeTruthy();
  expect(((await anularRes.json()) as { estado: string }).estado).toBe("anulado");

  await page.reload({ waitUntil: "domcontentloaded" });
  const filaAnulada = page.locator("tr", { hasText: referencia });
  await expect(filaAnulada.getByText("Anulado")).toBeVisible();

  await context.close();
});
