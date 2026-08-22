import { defineConfig, devices } from "@playwright/test";

// El servidor NO se levanta desde Playwright: ejecutar antes
// powershell -NoProfile -ExecutionPolicy Bypass -File scripts/serve-console.ps1
// (next start en http://localhost:3112).
export default defineConfig({
  testDir: "./e2e",
  // La suite de operación en vivo (e2e/vivo*) tiene su propio config:
  // playwright.vivo.config.ts (no debe correr con la regresión).
  testIgnore: ["**/vivo/**", "**/vivo-serie/**"],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  webServer: null,
  use: {
    baseURL: "http://localhost:3112",
    headless: true,
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Regresión de layout/RBAC en celular (diseño mobile-first para doctor/asistente).
      name: "mobile",
      testMatch: "rbac.spec.ts",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
