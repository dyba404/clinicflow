import { chromium, request } from "@playwright/test";

const BASE = "http://localhost:3112";

const TOKEN_PORTAL = "f03c005989a188e368faaff58670d814";
const TOKEN_GESTIONAR = "5551c8585120a214a04bc8113e575315b4b4c78556e7e7aa";
const FICHA = "75f57945-8ad7-4649-b0dd-34aab7b0fdfd";

const PUBLICAS = {
  landing: "/",
  reserva: "/dental/reserva",
  portal: `/dental/portal/${TOKEN_PORTAL}`,
  gestionar: `/dental/gestionar/${TOKEN_GESTIONAR}`,
  privacidad: "/dental/privacidad",
};

const CONSOLA = {
  panel: "/consola",
  agenda: "/consola/agenda",
  ficha: `/consola/pacientes/${FICHA}`,
  salaEspera: "/consola/sala-espera",
  legal: "/consola/config/legal",
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

const problemas = [];

async function revisar(page, vpWidth) {
  const res = await page.evaluate((vw) => {
    const out = [];
    let truncados = 0;
    let fueraVertical = 0;
    let textoInvisible = 0;
    document.querySelectorAll("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const cs = getComputedStyle(el);
      if (cs.overflowY !== "hidden" && r.bottom > window.innerHeight + 200 && r.top < window.innerHeight + 210) fueraVertical++;
      if (el.children.length === 0 && el.textContent && el.textContent.trim()) {
        if (cs.overflow === "hidden" && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 20) {
          if (r.width < 60 && el.textContent.trim().length > 8) truncados++;
        }
        const color = cs.color;
        const m = color.match(/\d+/g);
        if (m) {
          const [rr, gg, bb] = m.map(Number);
          const bg = cs.backgroundColor.match(/\d+/g);
          if (bg) {
            const [br, bgg, bb2, alpha] = bg.map(Number);
            if (alpha === 0) return;
            const lum1 = 0.299 * rr + 0.587 * gg + 0.114 * bb;
            const lum2 = 0.299 * br + 0.587 * bgg + 0.114 * bb2;
            if (Math.abs(lum1 - lum2) < 18) textoInvisible++;
          }
        }
      }
    });
    let tapados = 0;
    document.querySelectorAll("button, a").forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.width < 10 || r.height < 10 || r.top < 0 || r.left < 0) return;
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (el && el !== b && !b.contains(el) && !el.contains(b)) tapados++;
    });
    // Tap targets: controles reales con aspecto de botón < 44px (excluye links de texto inline)
    const tapChicos = [];
    document.querySelectorAll("button, [role=button], select").forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.width < 10 || r.height < 10 || r.bottom < 0 || r.top > window.innerHeight) return;
      const cs = getComputedStyle(b);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none") return;
      if (r.height < 44 || r.width < 44) {
        const texto = (b.textContent || "").trim().slice(0, 32);
        tapChicos.push(
          `${b.tagName.toLowerCase()}${texto ? ` "${texto}"` : ""} ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
      }
    });
    document.querySelectorAll("a").forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.width < 10 || r.height < 10 || r.bottom < 0 || r.top > window.innerHeight) return;
      const cs = getComputedStyle(b);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none") return;
      const cls = typeof b.className === "string" ? b.className : "";
      const pareceBoton =
        cs.backgroundColor !== "rgba(0, 0, 0, 0)" ||
        /rounded-(md|lg|xl|2xl|full)/.test(cls);
      if (!pareceBoton) return; // link de texto inline: no aplica el mínimo táctil
      if (r.height < 44 || r.width < 44) {
        const texto = (b.textContent || "").trim().slice(0, 32);
        tapChicos.push(`a ${texto ? `"${texto}" ` : ""}${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    });
    return { truncados, fueraVertical, textoInvisible, tapados, tapChicos };
  }, vpWidth);
  return res;
}

// hasTouch activa pointer:coarse (misma media query que usa la app para ≥48px);
// el init script descarta el banner de instalación para no contaminar la medición.
async function contextoTactil(browser, vp, cookie) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: true,
  });
  if (cookie) {
    await ctx.addCookies([{ name: "of_session", value: cookie, domain: "localhost", path: "/" }]);
  }
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("of-pwa-descartado", "1");
    } catch {}
  });
  return ctx;
}

const REPORT_TAP_UMBRAL = 3;

for (const vp of [{ name: "movil", width: 390, height: 844 }, { name: "tablet", width: 820, height: 1180 }]) {
  const browser = await chromium.launch();
  const token = await loginOwner();

  const ctxPub = await contextoTactil(browser, vp, null);
  const pub = await ctxPub.newPage();
  for (const [nombre, ruta] of Object.entries(PUBLICAS)) {
    await pub.goto(BASE + ruta, { waitUntil: "domcontentloaded" });
    await pub.waitForTimeout(800);
    const r = await revisar(pub, vp.width);
    const hot = [];
    if (r.tapados > 0) hot.push(`${r.tapados} botones/links tapados`);
    if (r.truncados > 2) hot.push(`${r.truncados} textos truncados`);
    if (r.textoInvisible > 2) hot.push(`${r.textoInvisible} textos con contraste bajo`);
    if (r.tapChicos.length >= REPORT_TAP_UMBRAL) {
      hot.push(`${r.tapChicos.length} tap targets <44px: ${r.tapChicos.slice(0, 5).join(" | ")}`);
    }
    if (hot.length) problemas.push(`${vp.name} ${nombre}: ${hot.join(", ")}`);
  }
  await ctxPub.close();

  const ctxStaff = await contextoTactil(browser, vp, token);
  const staff = await ctxStaff.newPage();
  for (const [nombre, ruta] of Object.entries(CONSOLA)) {
    await staff.goto(BASE + ruta, { waitUntil: "domcontentloaded" });
    await staff.waitForTimeout(900);
    const r = await revisar(staff, vp.width);
    const hot = [];
    if (r.tapados > 0) hot.push(`${r.tapados} botones/links tapados`);
    if (r.truncados > 2) hot.push(`${r.truncados} textos truncados`);
    if (r.textoInvisible > 2) hot.push(`${r.textoInvisible} textos con contraste bajo`);
    if (r.tapChicos.length >= REPORT_TAP_UMBRAL) {
      hot.push(`${r.tapChicos.length} tap targets <44px: ${r.tapChicos.slice(0, 5).join(" | ")}`);
    }
    if (hot.length) problemas.push(`${vp.name} ${nombre}: ${hot.join(", ")}`);
  }
  await ctxStaff.close();
  await browser.close();
}

console.log(`\n=== ${problemas.length} problemas de usabilidad móvil/tablet (contexto táctil, incluye tap targets <44px) ===`);
problemas.forEach((p) => console.log(p));
