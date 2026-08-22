import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(here, "../../../.env.local");
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1]) process.env[m[1]] = m[2] ?? "";
  }
}
const urlEnv = process.env.DATABASE_URL;
if (!urlEnv) throw new Error("DATABASE_URL no definido");
const url: string = urlEnv;

const PATRONES_PACIENTE = [
  "nombre LIKE 'Paciente E2E %'",
  "nombre LIKE 'Paciente Vivo %'",
  "nombre LIKE 'Paciente Publico %'",
  "nombre LIKE 'Recepcion %'",
  "nombre LIKE 'Contienda %'",
  "nombre LIKE 'Dueña E2E %'",
  "nombre LIKE 'Dueño Dup %'",
  "email LIKE '%@e2e.local'",
  "email LIKE '%@e2e.clinicflow.local'",
  "email LIKE '%@equipo.local'",
  "email LIKE '%@qa.local'",
  "email LIKE '%@test.local'",
];

// Orden de borrado respetando FK (ver pg_constraint):
// receipts -> payments -> dependientes de citas -> citas -> pacientes.
const TABLAS_DEPENDIENTES_PACIENTE = [
  "quotes",
  "patient_coverages",
  "patient_magic_tokens",
  "waitlists",
  "data_requests",
];

async function main() {
  const client = postgres(url, { max: 1, connect_timeout: 10, ssl: false });
  try {
    const condiciones = PATRONES_PACIENTE.join(" OR ");
    const [total] = await client.unsafe(`SELECT count(*)::int AS n FROM patients WHERE ${condiciones}`);
    console.log(`Pacientes QA encontrados: ${total?.n ?? 0}`);
    if ((total?.n ?? 0) === 0) {
      console.log("Nada que limpiar.");
      return;
    }

    const citaQa = `appointment_id IN (SELECT id FROM appointments WHERE patient_id IN (SELECT id FROM patients WHERE ${condiciones}))`;
    const pacienteQa = `patient_id IN (SELECT id FROM patients WHERE ${condiciones})`;

    const antes = await client.unsafe(`SELECT
      (SELECT count(*) FROM patients WHERE ${condiciones})::int AS pacientes,
      (SELECT count(*) FROM appointments WHERE ${pacienteQa})::int AS citas,
      (SELECT count(*) FROM payments WHERE ${pacienteQa})::int AS pagos,
      (SELECT count(*) FROM receipts WHERE payment_id IN (SELECT id FROM payments WHERE ${pacienteQa}))::int AS comprobantes`);

    await client.begin(async (tx) => {
      for (const t of TABLAS_DEPENDIENTES_PACIENTE) {
        await tx.unsafe(`DELETE FROM ${t} WHERE ${pacienteQa}`);
      }
      await tx.unsafe(`DELETE FROM clinical_records WHERE ${pacienteQa} OR ${citaQa}`);
      await tx.unsafe(`DELETE FROM attachments WHERE ${pacienteQa} OR ${citaQa}`);
      await tx.unsafe(`DELETE FROM reminders WHERE paciente_id IN (SELECT id FROM patients WHERE ${condiciones}) OR cita_id IN (SELECT id FROM appointments WHERE patient_id IN (SELECT id FROM patients WHERE ${condiciones}))`);
      await tx.unsafe(`DELETE FROM review_requests WHERE ${pacienteQa} OR ${citaQa}`);
      await tx.unsafe(`DELETE FROM signed_consents WHERE patient_id IN (SELECT id FROM patients WHERE ${condiciones}) OR cita_id IN (SELECT id FROM appointments WHERE patient_id IN (SELECT id FROM patients WHERE ${condiciones}))`);
      await tx.unsafe(`DELETE FROM dispensations WHERE ${pacienteQa}`);
      await tx.unsafe(`DELETE FROM admissions WHERE ${pacienteQa}`);
      await tx.unsafe(`DELETE FROM orders WHERE ${pacienteQa} OR ${citaQa}`);
      await tx.unsafe(`DELETE FROM consultations WHERE ${pacienteQa} OR ${citaQa}`);
      await tx.unsafe(`UPDATE beds SET estado = 'libre' WHERE estado = 'ocupada' AND NOT EXISTS (SELECT 1 FROM bed_assignments ba WHERE ba.bed_id = beds.id AND ba.hasta IS NULL)`);
      await tx.unsafe(`DELETE FROM stock_movements WHERE ${citaQa}`);
      await tx.unsafe(`DELETE FROM whatsapp_messages WHERE ${pacienteQa}`);
      await tx.unsafe(`DELETE FROM receipts WHERE payment_id IN (SELECT id FROM payments WHERE ${pacienteQa})`);
      await tx.unsafe(`DELETE FROM commission_entries WHERE payment_id IN (SELECT id FROM payments WHERE ${pacienteQa}) OR ${citaQa}`);
      await tx.unsafe(`DELETE FROM installments WHERE payment_id IN (SELECT id FROM payments WHERE ${pacienteQa})`);
      await tx.unsafe(`DELETE FROM payments WHERE ${pacienteQa}`);
      await tx.unsafe(`DELETE FROM appointments WHERE ${pacienteQa}`);
      await tx.unsafe(`DELETE FROM patients WHERE ${condiciones}`);
    });

    const despues = await client.unsafe(`SELECT
      (SELECT count(*) FROM patients WHERE ${condiciones})::int AS pacientes,
      (SELECT count(*) FROM appointments WHERE ${pacienteQa})::int AS citas`);

    console.log(
      `Eliminado: ${antes?.[0]?.pacientes ?? 0} pacientes, ${antes?.[0]?.citas ?? 0} citas, ` +
        `${antes?.[0]?.pagos ?? 0} pagos, ${antes?.[0]?.comprobantes ?? 0} comprobantes.`,
    );
    console.log(`Verificación post-limpieza: pacientes ${despues?.[0]?.pacientes ?? 0}, citas ${despues?.[0]?.citas ?? 0}.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});