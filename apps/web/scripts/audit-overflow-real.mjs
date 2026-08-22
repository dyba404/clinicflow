import { chromium, request } from "@playwright/test";

const BASE = "http://localhost:3112";

const VIEWPORTS = [
  { name: "movil", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
];

const REVISAR = {
  publicas: [],
  consola: ["panel", "agenda", "solicitudes", "pacientes", "caja", "comprobantes", "cuotas", "presupuestos", "recall", "inventario", "lista-espera", "whatsapp", "auditoria", "admin"],
};

const RUTAS = {
  panel: "/consola",
  agenda: "/consola/agenda",
  solicitudes: "/consola/solicitudes",
  pacientes: "/consola/pacientes",
  caja: "/consola/caja",
  comprobantes: "/consola/caja/comprobantes",
  cuotas: "/consola/cuotas",
  presupuestos: "/consola/presupuestos",
  recall: "/consola/recall",
  inventario: "/consola/inventario",
  "lista-espera": "/consola/lista-espera",
  whatsapp: "/consola/whatsapp",
  auditoria: "/consola/auditoria",
  admin: "/admin",
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

const verdaderos = [];

for (const vp of VIEWPORTS) {
  const browser = await chromium.launch();
  const token = await loginOwner();
  const contexto = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await contexto.addCookies([{ name: "of_session", value: token, domain: "localhost", path: "/" }]);
  const page = await contexto.newPage();

  for (const nombre of REVISAR.consola) {
    await page.goto(BASE + RUTAS[nombre], { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(800);
    const res = await page.evaluate(() => {
      const sw = document.documentElement.scrollWidth;
      const cw = document.documentElement.clientWidth;
      let culpable = "";
      if (sw - cw > 4) {
        document.querySelectorAll("body *").forEach((el) => {
          if (culpable) return;
          const r = el.getBoundingClientRect();
          if (r.right > cw + 4 && r.left >= 0) {
            let dentroScroll = false;
            let anc = el.parentElement;
            while (anc && anc !== document.body) {
              const cs = getComputedStyle(anc);
              if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && anc.scrollWidth > anc.clientWidth) {
                dentroScroll = true; break;
              }
              anc = anc.parentElement;
            }
            if (!dentroScroll) culpable = `${el.tagName}.${String(el.className).split(" ").slice(0, 3).join(".")}`;
          }
        });
      }
      return { sw, cw, culpable };
    });
    if (res.sw - res.cw > 4) {
      verdaderos.push(`${vp.name} ${nombre}: REAL +${res.sw - res.cw}px -> ${res.culpable}`);
    } else {
      console.log(`${vp.name} ${nombre}: OK (scrollable interno, no desborda)`);
    }
  }
  await contexto.close();
  await browser.close();
}

console.log(`\n=== ${verdaderos.length} desbordes REALES de página ===`);
verdaderos.forEach((p) => console.log(p));
