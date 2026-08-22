import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { cie10 } from "./schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(here, "../../../.env.local");
if (!process.env.DATABASE_URL) {
  const contenido = readFileSync(envFile, "utf8").replace(/^\uFEFF/, "");
  for (const line of contenido.split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1]) process.env[m[1]] = m[2] ?? "";
  }
}

// Import dinámico: client.ts lee DATABASE_URL al inicializarse, así que el
// .env.local debe estar cargado ANTES de importarlo.
const { getDb } = await import("./client.js");

// Catálogo oficial ICD-10-CM 2026 (.references/openemr/contrib/icd10).
// Formato fixed-width: orden(5) + código(7+pad) + "0|1" + descripción larga + 2+
// espacios + descripción corta. Reemplazable por catálogo MINSA en español
// manteniendo el parser. Idempotente: upsert por código.
const src = process.argv[2] ?? resolve(here, "../../../.data/cie10/icd10cm_order_2026.txt");
const lineas = readFileSync(src, "utf8").split(/\r?\n/);

const filas: { codigo: string; descripcion: string; orden: string }[] = [];
for (const linea of lineas) {
  if (linea.length < 20) continue;
  const orden = linea.slice(0, 5).trim();
  const codigo = linea.slice(6, 14).trim();
  const resto = linea.slice(15).trim();
  const descLarga = (resto.split(/\s{2,}/)[0] ?? resto).replace(/^[01]\s/, "").trim();
  if (!/^[A-Z][0-9A-Z.]{2,}$/i.test(codigo) || !descLarga) continue;
  filas.push({ codigo, descripcion: descLarga, orden });
}

const db = getDb();
const CHUNK = 2000;
let ok = 0;
for (let i = 0; i < filas.length; i += CHUNK) {
  const lote = filas.slice(i, i + CHUNK);
  const res = await db
    .insert(cie10)
    .values(lote)
    .onConflictDoNothing({ target: cie10.codigo })
    .returning({ codigo: cie10.codigo });
  ok += res.length;
}
console.log(`CIE-10 cargado: ${ok} códigos insertados / ${filas.length} parseados (fuente: ${src})`);
process.exit(0);
