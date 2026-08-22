import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";
import { upsertFundador, FOUNDER_NAME_DEV } from "./fundador.js";

const here = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(here, "../../.env.local");
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1]) process.env[m[1]] = m[2] ?? "";
  }
}

const urlEnv = process.env.DATABASE_URL;
if (!urlEnv) throw new Error("DATABASE_URL no definido");

const email = (process.env.FOUNDER_EMAIL ?? "").trim().toLowerCase();
const password = process.env.FOUNDER_PASSWORD ?? "";
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("FOUNDER_EMAIL no definido o invalido (variable de entorno).");
  process.exit(1);
}
if (password.length < 8) {
  console.error("FOUNDER_PASSWORD debe tener al menos 8 caracteres (variable de entorno).");
  process.exit(1);
}

function hashPassword(p: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(p, salt, 64);
  return `scrypt:${salt}:${Buffer.from(key).toString("hex")}`;
}

async function main() {
  const client = postgres(urlEnv as string, { max: 1, connect_timeout: 10, ssl: false, idle_timeout: 5 });
  try {
    const db = drizzle(client, { schema });
    const { creado } = await upsertFundador(db, {
      email,
      name: process.env.FOUNDER_NAME ?? FOUNDER_NAME_DEV,
      passwordHash: hashPassword(password),
      mustChangePassword: true,
    });
    if (creado) {
      console.log(`Fundador creado: ${email} (debe cambiar la contrasena en el primer login).`);
    } else {
      console.log(`Fundador ya existe: ${email}. No se modifico (usa admin:change-password para rotar).`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
