import { execSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensurePostgres } from "./ensure-db.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const cmd = process.argv[2];

if (!["migrate", "push"].includes(cmd)) {
  console.error("Uso: node scripts/db-task.mjs <migrate|push>");
  process.exit(1);
}

await ensurePostgres(repoRoot, { label: `db:${cmd}` });

execSync(`npx drizzle-kit ${cmd}`, {
  cwd: join(repoRoot, "packages", "db"),
  stdio: "inherit",
});
