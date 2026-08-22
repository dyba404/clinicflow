import { chromium, request } from "@playwright/test";

const BASE = "http://localhost:3112";
const OUT = "C:\\Users\\Administrator\\Documents\\projects\\clinicflow\\apps\\web\\public\\guia";
const FICHA = "75f57945-8ad7-4649-b0dd-34aab7b0fdfd";
const TOKEN_PORTAL = "f03c005989a188e368faaff58670d814";

const PUBLICAS = {
  portal: `/dental/portal/${TOKEN_PORTAL}`,
  reserva: "/dental/reserva",
};

const CONSOLA = {
  panel: "/consola",
  agenda: "/consola/agenda",
  solicitudes: "/consola/solicitudes",
  "sala-espera": "/consola/sala-espera",
  pacientes: "/consola/pacientes",
  ficha: `/consola/pacientes/${FICHA}`,
  caja: "/consola/caja",
  comprobantes: "/consola/caja/comprobantes",
  cuotas: "/consola/cuotas",
  presupuestos: "/consola/presupuestos",
  recall: "/consola/recall",
  "config-legal": "/consola/config/legal",
  "config-fiscal": "/consola/config/fiscal",
  soporte: "/consola/soporte",
};

async function loginOwner() {
  const ctx = await request.newContext();
  const res = await ctx.post(`${BASE}/api/auth/login`, {
    data: { email: "owner@demo.clinicflow.pe", password: "demo1234" },
  });
  const setCookie = (await res.headersArray())
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value)
    .find((c) => c.startsWith("of_session="));
  await ctx.dispose();
  return setCookie.split(";")[0].slice("of_session=".length);
}

const browser = await chromium.launch();

const ctxPub = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const pub = await ctxPub.newPage();
for (const [nombre, ruta] of Object.entries(PUBLICAS)) {
  await pub.goto(BASE + ruta, { waitUntil: "domcontentloaded" });
  await pub.waitForTimeout(800);
  await pub.screenshot({ path: `${OUT}\\${nombre}.png` });
  console.log(`OK ${nombre}`);
}
await ctxPub.close();

const token = await loginOwner();
const ctxStaff = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctxStaff.addCookies([{ name: "of_session", value: token, domain: "localhost", path: "/" }]);
const staff = await ctxStaff.newPage();
for (const [nombre, ruta] of Object.entries(CONSOLA)) {
  await staff.goto(BASE + ruta, { waitUntil: "domcontentloaded" });
  await staff.waitForTimeout(900);
  await staff.screenshot({ path: `${OUT}\\${nombre}.png` });
  console.log(`OK ${nombre}`);
}
await ctxStaff.close();
await browser.close();
console.log("Capturas de guía listas en public/guia");
