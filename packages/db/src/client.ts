import { spawn } from "node:child_process";
import { connect as netConnect, Socket } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type ClinicflowDb = ReturnType<typeof buildDb>;

const REVIVE_WAIT_MS = 25_000;
const SOCKET_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseDbTarget(url: string | undefined): { host: string; port: number } {
  if (!url) return { host: "127.0.0.1", port: 5432 };
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: parsed.port ? Number(parsed.port) : 5432,
    };
  } catch {
    return { host: "127.0.0.1", port: 5432 };
  }
}

const { host: DB_HOST, port: DB_PORT } = parseDbTarget(process.env.DATABASE_URL);

function repoRootWsl(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
    .replace(/\\/g, "/")
    .replace(/^([A-Za-z]):/, (_: string, d: string) => `/mnt/${d.toLowerCase()}`);
}

function tcpProbe(): Promise<boolean> {
  return new Promise((done) => {
    const s = netConnect({ port: DB_PORT, host: DB_HOST });
    const timer = setTimeout(() => {
      s.destroy();
      done(false);
    }, 2500);
    s.once("connect", () => {
      clearTimeout(timer);
      s.destroy();
      done(true);
    });
    s.once("error", () => {
      clearTimeout(timer);
      done(false);
    });
  });
}

let lastRevive = 0;

function reviveWslDocker(): void {
  if (process.platform !== "win32") return;
  const now = Date.now();
  if (now - lastRevive < 10_000) return;
  lastRevive = now;
  const compose = `${repoRootWsl()}/docker-compose.yml`;
  const cmd =
    "sudo -n systemctl start docker >/dev/null 2>&1; " +
    `sudo -n docker compose -f ${compose} up -d >/dev/null 2>&1; true`;
  try {
    const child = spawn(
      "wsl.exe",
      ["-d", "Ubuntu", "-u", "dev", "-e", "bash", "-lc", cmd],
      {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      },
    );
    child.unref();
  } catch {
    return;
  }
}

async function waitForDb(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await tcpProbe()) return true;
    await sleep(1500);
  }
  return false;
}

function connectSocket(timeoutMs: number): Promise<Socket | null> {
  return new Promise((done) => {
    const socket = netConnect({ port: DB_PORT, host: DB_HOST });
    const timer = setTimeout(() => {
      socket.destroy();
      done(null);
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      done(socket);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      socket.destroy();
      done(null);
    });
  });
}

async function dbSocketWithRevive(): Promise<Socket> {
  for (let attempt = 0; attempt < SOCKET_ATTEMPTS; attempt++) {
    if (!(await tcpProbe())) reviveWslDocker();
    if (await waitForDb(REVIVE_WAIT_MS)) {
      const socket = await connectSocket(8_000);
      if (socket) return socket;
    }
    await sleep(1000 * (attempt + 1));
  }
  throw Object.assign(new Error(`postgres_no_disponible_en_${DB_HOST}:${DB_PORT}`), {
    code: "ECONNREFUSED",
  });
}

type DbOptions = postgres.Options<{}> & {
  socket?: (options: postgres.Options<{}>) => Promise<Socket>;
};

function buildDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no definido (ver .env.local.example)");
  const options: DbOptions = {
    max: 4,
    idle_timeout: 20,
    // Forzar reconexion periodica: WSL se suspende por inactividad y deja
    // sockets muertos; con max_lifetime el pool los renueva solo.
    max_lifetime: 300,
    connect_timeout: 15,
    onnotice: () => {},
    socket: () => dbSocketWithRevive(),
  };
  const client = postgres(url, options as postgres.Options<{}>);
  return drizzle(client, { schema });
}

declare global {
  // eslint-disable-next-line no-var
  var __clinicflowDb: ClinicflowDb | undefined;
}

export function getDb(): ClinicflowDb {
  if (!globalThis.__clinicflowDb) {
    globalThis.__clinicflowDb = buildDb();
  }
  return globalThis.__clinicflowDb;
}
