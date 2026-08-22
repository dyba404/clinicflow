import { defineConfig, devices } from "@playwright/test";

// Suite de "operación en vivo" (v1.6.0): simula un consultorio operando de
// verdad — todo por UI, tenants/pacientes únicos por corrida, sin teardown.
//
// Ejecución en dos tandas (la serie debe ir a solas porque pausa la BD y
// apaga la red del contexto):
//   npx playwright test --config playwright.vivo.config.ts --project vivo --project movil-vivo
//   npx playwright test --config playwright.vivo.config.ts --project vivo-serie
//
// Requiere: servidor en :3112 (scripts/serve-console.ps1), Mailpit :8025 y
// WSL/Docker arriba (scripts/of.ps1 up).
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["vivo/*.spec.ts", "vivo-serie/*.spec.ts"],
  timeout: 180_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3112",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      // Operación real simulada: 3 workers en paralelo = saturación.
      name: "vivo",
      testMatch: "vivo/*.spec.ts",
      fullyParallel: true,
      workers: 3,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // El mismo día de operación en celular (Pixel 7).
      name: "movil-vivo",
      testMatch: "vivo/02-operacion.spec.ts",
      workers: 1,
      use: { ...devices["Pixel 7"] },
    },
    {
      // Resiliencia: rate limit, corte de BD, offline. Va a solas.
      name: "vivo-serie",
      testMatch: "vivo-serie/*.spec.ts",
      workers: 1,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
