import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensurePostgres } from "./ensure-db.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

await ensurePostgres(repoRoot, { label: "dev" });

let alive = true;

function spawnKeepalive() {
  const p = spawn("wsl.exe", ["-d", "Ubuntu", "-e", "tail", "-f", "/dev/null"], {
    stdio: "ignore",
    shell: false,
  });
  p.on("exit", () => {
    if (alive) setTimeout(spawnKeepalive, 5000);
  });
}
spawnKeepalive();

const child = spawn("npm.cmd", ["run", "dev", "-w", "@clinicflow/web"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  alive = false;
  process.exit(code ?? 0);
});

process.on("SIGINT", () => {
  alive = false;
  child.kill("SIGINT");
});
