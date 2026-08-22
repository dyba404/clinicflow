import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const OUT_ICONS = join(ROOT, "public", "icons");
const OUT_APP = join(ROOT, "src", "app");
mkdirSync(OUT_ICONS, { recursive: true });

const TEAL = "#0d9488";

function svgAny(size, ratioLetra = 0.52) {
  const fs = Math.round(size * ratioLetra);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" fill="${TEAL}"/>`,
    `<text x="${size / 2}" y="${size / 2}" font-family="Arial, Helvetica, sans-serif" font-size="${fs}" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">O</text>`,
    `</svg>`,
  ].join("");
}

const OBJETIVOS = [
  { archivo: join(OUT_ICONS, "icon-192.png"), size: 192, svg: svgAny(192) },
  { archivo: join(OUT_ICONS, "icon-512.png"), size: 512, svg: svgAny(512) },
  {
    archivo: join(OUT_ICONS, "icon-512-maskable.png"),
    size: 512,
    svg: svgAny(512, 0.4),
  },
  {
    archivo: join(OUT_APP, "apple-icon.png"),
    size: 180,
    svg: svgAny(180, 0.5),
  },
];

const browser = await chromium.launch();
const context = await browser.newContext({ deviceScaleFactor: 1 });
const page = await context.newPage();

for (const objetivo of OBJETIVOS) {
  await page.setViewportSize({ width: objetivo.size, height: objetivo.size });
  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(objetivo.svg)}`;
  await page.setContent(
    `<!doctype html><html><head><style>html,body{margin:0;padding:0}</style></head><body><img src="${dataUri}" width="${objetivo.size}" height="${objetivo.size}" style="display:block"></body></html>`,
    { waitUntil: "networkidle" },
  );
  await page.screenshot({
    path: objetivo.archivo,
    clip: { x: 0, y: 0, width: objetivo.size, height: objetivo.size },
  });
  console.log(`OK ${objetivo.archivo}`);
}

await browser.close();
