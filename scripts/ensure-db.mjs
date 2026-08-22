import { execSync } from "node:child_process";
import net from "node:net";
import { join } from "node:path";

export function winPathToWsl(p) {
  const m = p.match(/^([A-Za-z]):(.*)$/);
  if (!m) return p;
  return `/mnt/${m[1].toLowerCase()}${m[2].replaceAll("\\", "/")}`;
}

export function tcpProbe(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const s = net.connect({ port, host });
    s.once("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.once("error", () => resolve(false));
  });
}

export function runQuiet(cmd, timeoutMs = 120000) {
  try {
    execSync(cmd, { stdio: "ignore", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

export async function ensurePostgres(repoRoot, { port = 5433, label = "ensure-db" } = {}) {
  if (process.platform !== "win32") return true;
  if (await tcpProbe(port)) return true;

  console.log(`[${label}] Postgres caído, levantando WSL + Docker...`);
  const compose = winPathToWsl(join(repoRoot, "docker-compose.yml"));
  runQuiet("wsl.exe -d Ubuntu -e true", 60000);
  runQuiet(
    `wsl.exe -d Ubuntu -u dev -e bash -lc "sudo service docker start >/dev/null 2>&1; sudo systemctl start docker >/dev/null 2>&1; sudo docker compose -f ${compose} up -d >/dev/null 2>&1; true"`,
    180000,
  );

  for (let i = 0; i < 45; i++) {
    if (await tcpProbe(port)) {
      console.log(`[${label}] Postgres listo.`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.warn(`[${label}] Advertencia: Postgres no respondió en 127.0.0.1:${port}`);
  return false;
}
