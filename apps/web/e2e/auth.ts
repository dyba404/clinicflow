import { request, type Browser, type BrowserContext } from "@playwright/test";

export type Rol = "owner" | "receptionist" | "assistant" | "doctor";

export const PASSWORD_DEMO = "demo1234";

export const USUARIOS: Record<Rol, { email: string; etiqueta: string }> = {
  owner: { email: "owner@demo.clinicflow.pe", etiqueta: "Dueño/a" },
  receptionist: { email: "recepcion@demo.clinicflow.pe", etiqueta: "Recepción" },
  assistant: { email: "asistente@demo.clinicflow.pe", etiqueta: "Asistente" },
  doctor: { email: "luis@demo.clinicflow.pe", etiqueta: "Odontólogo/a" },
};

export const ROLES: Rol[] = ["owner", "receptionist", "assistant", "doctor"];

export async function loginPorApi(email: string): Promise<string> {
  const ctx = await request.newContext();
  try {
    for (let intento = 0; intento < 3; intento++) {
      const res = await ctx.post("http://localhost:3112/api/auth/login", {
        data: { email, password: PASSWORD_DEMO },
      });
      if (res.status() === 429) {
        const retryAfter = Number(res.headers()["retry-after"] ?? "15");
        await new Promise((r) => setTimeout(r, Math.min(retryAfter * 1000, 30_000)));
        continue;
      }
      if (!res.ok()) {
        throw new Error(`login falló (${email}): ${res.status()} ${await res.text()}`);
      }
      const setCookie = (await res.headersArray())
        .filter((h) => h.name.toLowerCase() === "set-cookie")
        .map((h) => h.value)
        .find((c) => c.startsWith("of_session="));
      if (!setCookie) throw new Error(`login sin cookie of_session (${email})`);
      return setCookie.split(";")[0]!.slice("of_session=".length);
    }
    throw new Error(`login agotó reintentos por rate limit (${email})`);
  } finally {
    await ctx.dispose();
  }
}

export async function contextConSesion(browser: Browser, rol: Rol): Promise<BrowserContext> {
  const token = await loginPorApi(USUARIOS[rol].email);
  const context = await browser.newContext();
  await context.addCookies([
    { name: "of_session", value: token, domain: "localhost", path: "/" },
  ]);
  return context;
}
