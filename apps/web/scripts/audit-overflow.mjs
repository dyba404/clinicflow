import { chromium, request } from "@playwright/test";

const BASE = "http://localhost:3112";

const VIEWPORTS = [
  { name: "movil", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
];

const FICHA_PACIENTE = "75f57945-8ad7-4649-b0dd-34aab7b0fdfd";
const TOKEN_PORTAL = "f03c005989a188e368faaff58670d814";
const TOKEN_GESTIONAR = "5551c8585120a214a04bc8113e575315b4b4c78556e7e7aa";

const RUTAS_PUBLICAS = [
  ["landing", "/"],
  ["login", "/login"],
  ["signup", "/signup"],
  ["reserva", "/dental/reserva"],
  ["privacidad", "/dental/privacidad"],
  ["terminos", "/dental/terminos"],
  ["portal", `/dental/portal/${TOKEN_PORTAL}`],
  ["gestionar", `/dental/gestionar/${TOKEN_GESTIONAR}`],
];

const RUTAS_CONSOLA = [
  ["panel", "/consola"],
  ["agenda", "/consola/agenda"],
  ["solicitudes", "/consola/solicitudes"],
  ["sala-espera", "/consola/sala-espera"],
  ["pacientes", "/consola/pacientes"],
  ["ficha", `/consola/pacientes/${FICHA_PACIENTE}`],
  ["caja", "/consola/caja"],
  ["comprobantes", "/consola/caja/comprobantes"],
  ["cuotas", "/consola/cuotas"],
  ["dashboard", "/consola/dashboard"],
  ["presupuestos", "/consola/presupuestos"],
  ["recall", "/consola/recall"],
  ["campanas", "/consola/campanas"],
  ["inventario", "/consola/inventario"],
  ["lista-espera", "/consola/lista-espera"],
  ["whatsapp", "/consola/whatsapp"],
  ["personal", "/consola/personal"],
  ["auditoria", "/consola/auditoria"],
  ["arco", "/consola/arco"],
  ["config-servicios", "/consola/config/servicios"],
  ["config-notificaciones", "/consola/config/notificaciones"],
  ["config-fiscal", "/consola/config/fiscal"],
  ["config-whatsapp", "/consola/config/whatsapp"],
  ["config-legal", "/consola/config/legal"],
  ["soporte", "/consola/soporte"],
  ["admin", "/admin"],
];

async function loginOwner() {
  const ctx = await request.newContext();
  const res = await ctx.post(`${BASE}/api/auth/login`, {
    data: { email: "owner@demo.clinicflow.pe", password: "demo1234" },
  });
  if (!res.ok()) throw new Error(`login falló: ${res.status()}`);
  const setCookie = (await res.headersArray())
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value)
    .find((c) => c.startsWith("of_session="));
  await ctx.dispose();
  return setCookie.split(";")[0].slice("of_session=".length);
}

const problemas = [];

for (const vp of VIEWPORTS) {
  const browser = await chromium.launch();
  const contextoPublico = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await contextoPublico.newPage();

  async function medir(nombre, ruta) {
    try {
      await page.goto(BASE + ruta, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForTimeout(700);
      const res = await page.evaluate(() => {
        const sw = document.documentElement.scrollWidth;
        const cw = document.documentElement.clientWidth;
        let worst = 0; let worstSel = "";
        document.querySelectorAll("*").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > cw + 2) {
            if (r.width - cw > worst) {
              worst = Math.round(r.width - cw);
              worstSel = (el.className && typeof el.className === "string" ? el.className.split(" ")[0] : el.tagName);
            }
          }
        });
        return { scroll: sw, client: cw, worst, worstSel };
      });
      if (res.worst > 4) {
        problemas.push(`${vp.name} ${nombre}: overflow ${res.worst}px (${res.worstSel})`);
      }
    } catch (e) {
      problemas.push(`${vp.name} ${nombre}: ERROR ${e.message.split("\n")[0]}`);
    }
  }

  for (const [nombre, ruta] of RUTAS_PUBLICAS) await medir(nombre, ruta);
  await contextoPublico.close();

  const token = await loginOwner();
  const contextoStaff = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await contextoStaff.addCookies([{ name: "of_session", value: token, domain: "localhost", path: "/" }]);
  const staff = await contextoStaff.newPage();

  for (const [nombre, ruta] of RUTAS_CONSOLA) {
    try {
      await staff.goto(BASE + ruta, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await staff.waitForTimeout(900);
      const res = await staff.evaluate(() => {
        const sw = document.documentElement.scrollWidth;
        const cw = document.documentElement.clientWidth;
        let worst = 0; let worstSel = "";
        document.querySelectorAll("*").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > cw + 2) {
            if (r.width - cw > worst) {
              worst = Math.round(r.width - cw);
              worstSel = (el.className && typeof el.className === "string" ? el.className.split(" ")[0] : el.tagName);
            }
          }
        });
        return { scroll: sw, client: cw, worst, worstSel };
      });
      if (res.worst > 4) {
        problemas.push(`${vp.name} ${nombre}: overflow ${res.worst}px (${res.worstSel})`);
      }
    } catch (e) {
      problemas.push(`${vp.name} ${nombre}: ERROR ${e.message.split("\n")[0]}`);
    }
  }
  await contextoStaff.close();
  await browser.close();
}

console.log(`\n=== ${problemas.length} problemas detectados ===`);
problemas.forEach((p) => console.log(p));
