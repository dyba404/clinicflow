import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";

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

const email = (process.env.EMAIL ?? process.argv[2] ?? "").trim().toLowerCase();
const password = process.env.CONTRASENA ?? process.argv[3] ?? "";
if (!email || password.length < 8) {
  console.error('Uso: admin:change-password <email> <contrasena>');
  console.error("(tambien via EMAIL y CONTRASENA como variables de entorno)");
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
    const [usuario] = await db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (!usuario) {
      console.error(`Usuario no encontrado: ${email}`);
      process.exit(1);
    }
    await db
      .update(schema.users)
      .set({ passwordHash: hashPassword(password), mustChangePassword: false })
      .where(eq(schema.users.id, usuario.id));
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, usuario.id));
    console.log(`Contrasena actualizada para ${email}; sesiones cerradas.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
