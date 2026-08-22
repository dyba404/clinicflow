import { expect, test } from "@playwright/test";
import { USUARIOS, loginPorApi } from "./auth";

function mananaLima(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d);
}

// Flujo global completo (OLA 4): reserva → consulta → hospitalización →
// orden → resultado → egreso → facturación → SUNAT. Todo por API con sesión
// de owner (plan premium del equipo demo).
test("flujo global: reserva→consulta→hospitalización→orden→resultado→egreso→facturación→SUNAT", async ({
  browser,
}) => {
  const suffix = Date.now();
  const token = await loginPorApi(USUARIOS.owner.email);
  const context = await browser.newContext();
  await context.addCookies([
    { name: "of_session", value: token, domain: "localhost", path: "/" },
  ]);
  const api = context.request;

  // 0) Servicio de consulta.
  const svcRes = await api.get("/api/servicios");
  expect(svcRes.ok()).toBeTruthy();
  const { servicios } = (await svcRes.json()) as {
    servicios: Array<{ id: string; nombre: string }>;
  };
  const servicio =
    servicios.find((s) => s.nombre === "Consulta general") ?? servicios[0];
  expect(servicio).toBeTruthy();

  // 1) RESERVA: paciente + cita en el primer slot libre de mañana.
  const nombrePaciente = `Paciente Global ${suffix}`;
  const celular = `9${String(suffix).slice(-8)}`;
  const patRes = await api.post("/api/pacientes", {
    data: { nombre: nombrePaciente, celular, documento: `4${String(suffix).slice(-7)}` },
  });
  expect(patRes.status()).toBe(201);
  const { paciente } = (await patRes.json()) as { paciente: { id: string } };

  const fecha = mananaLima();
  const slotsRes = await api.get(
    `/api/clinicas/clinica-central/slots?serviceId=${servicio!.id}&date=${fecha}`,
  );
  expect(slotsRes.ok(), `slots: ${slotsRes.status()} ${await slotsRes.text()}`).toBeTruthy();
  const { slots } = (await slotsRes.json()) as {
    slots: Array<{ startTime: string }>;
  };
  expect(slots.length, "sin slots libres mañana").toBeGreaterThan(0);
  const horaIni = slots[0]!.startTime.slice(0, 5);

  const citaRes = await api.post("/api/citas", {
    data: {
      serviceId: servicio!.id,
      fecha,
      horaIni,
      paciente: { id: paciente.id },
    },
  });
  expect(citaRes.status(), `cita: ${citaRes.status()} ${await citaRes.text()}`).toBe(201);
  const { id: citaId } = (await citaRes.json()) as { id: string };

  // 2) CONSULTA: máquina de estados hasta atendida (la cita nace confirmada vía API).
  for (const estado of ["en_espera", "en_atencion", "atendida"]) {
    const r = await api.post(`/api/citas/${citaId}/estado`, { data: { estado } });
    expect(r.ok(), `transición a ${estado}: ${r.status()} ${await r.text()}`).toBeTruthy();
  }

  // 3) HOSPITALIZACIÓN: cama + admisión con cama asignada.
  const nombreCama = `Cama E2E ${suffix}`;
  const camaRes = await api.post("/api/hospitalizacion/camas", {
    data: { nombre: nombreCama, area: "Observación", tipo: "cama" },
  });
  expect(camaRes.status()).toBe(201);
  const { id: camaId } = (await camaRes.json()) as { id: string };

  const admRes = await api.post("/api/hospitalizacion", {
    data: {
      patientId: paciente.id,
      tipo: "observacion",
      motivo: `Observación post-consulta E2E ${suffix}`,
      cama: camaId,
    },
  });
  expect(admRes.status()).toBe(201);
  const { id: admisionId } = (await admRes.json()) as { id: string };

  // 4) ORDEN: laboratorio ligado al paciente.
  const ordenRes = await api.post("/api/ordenes", {
    data: {
      patientId: paciente.id,
      tipo: "laboratorio",
      nombre: "Hemograma E2E",
      indicacion: "Control post-consulta",
      appointmentId: citaId,
    },
  });
  expect(ordenRes.status()).toBe(201);
  const { id: ordenId } = (await ordenRes.json()) as { id: string };

  // 5) RESULTADO: ordenada→toma, cargar resultados, →procesada→validada→liberada.
  const aToma = await api.patch(`/api/ordenes/${ordenId}/estado`, { data: { estado: "toma" } });
  expect(aToma.ok(), `a toma: ${aToma.status()} ${await aToma.text()}`).toBeTruthy();

  const resRes = await api.post(`/api/ordenes/${ordenId}/resultados`, {
    data: {
      resultados: [
        { parametro: "Hemoglobina", valorNum: 13.2, unidad: "g/dL", referencia: "12-16" },
        { parametro: "Leucocitos", valorNum: 7100, unidad: "/uL", referencia: "4500-11000" },
      ],
    },
  });
  expect(resRes.status()).toBe(201);

  for (const estado of ["procesada", "validada", "liberada"]) {
    const r = await api.patch(`/api/ordenes/${ordenId}/estado`, { data: { estado } });
    expect(r.ok(), `orden a ${estado}: ${r.status()} ${await r.text()}`).toBeTruthy();
  }

  // 6) EGRESO: alta médica con epicrisis (libera la cama).
  const altaRes = await api.patch(`/api/hospitalizacion/${admisionId}`, {
    data: {
      alta: {
        tipo: "medica",
        epicrisis: `Paciente estable tras observación. Resultados de laboratorio dentro de rangos. Alta médica E2E ${suffix}.`,
      },
    },
  });
  expect(altaRes.ok(), `alta: ${altaRes.status()} ${await altaRes.text()}`).toBeTruthy();

  // 7) FACTURACIÓN: pago en caja.
  const referencia = `GLOBAL-${suffix}`;
  const pagoRes = await api.post("/api/caja/pagos", {
    data: {
      monto: 120,
      metodo: "efectivo",
      patientId: paciente.id,
      appointmentId: citaId,
      referencia,
    },
  });
  expect(pagoRes.status()).toBe(201);
  const { id: pagoId } = (await pagoRes.json()) as { id: string };

  // 8) SUNAT: comprobante (boleta) contra el pago.
  const compRes = await api.post("/api/caja/comprobantes", {
    data: { paymentId: pagoId, tipo: "boleta", serie: "BEG1", correlativo: Number(String(suffix).slice(-6)) || 1 },
  });
  expect(compRes.status(), `comprobante: ${compRes.status()} ${await compRes.text()}`).toBe(201);

  await context.close();
});
