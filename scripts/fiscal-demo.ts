import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const RUC_BETA = "20161515648";
const RAZON_SOCIAL_BETA = "SERVICIOS CABALLERO ROSAS";
// La UI (fiscal-form.tsx) envía el usuario secundario SIN el prefijo RUC;
// emitir.ts -> lycetGuardarEmpresa concatena `${ruc}${usuarioSol}` para SOL_USER.
const USUARIO_SOL = "MODDATOS";
const CLAVE_SOL = "MODDATOS";
const AMBIENTE = "beta";
const REGIMEN = "RER" as const;

function cargarEnv(ruta: string): void {
  if (!existsSync(ruta)) return;
  for (const linea of readFileSync(ruta, "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] && typeof process.env[m[1]] === "undefined") {
      process.env[m[1]] = m[2] ?? "";
    }
  }
}

function fallar(msg: string): never {
  console.error(`[fiscal-demo] ERROR: ${msg}`);
  process.exit(1);
}

async function main(): Promise<void> {
  // apps/web/.env.local primero: tiene LOCAL_MASTER_KEY (la app dev lee ese archivo).
  cargarEnv(resolve(root, "apps", "web", ".env.local"));
  cargarEnv(resolve(root, ".env.local"));

  if (!process.env.LOCAL_MASTER_KEY) {
    fallar("LOCAL_MASTER_KEY no encontrada en apps/web/.env.local (requerida para cifrar)");
  }
  if (!process.env.DATABASE_URL) {
    fallar("DATABASE_URL no encontrada en apps/web/.env.local ni .env.local");
  }

  const rutaCert = resolve(root, ".references", "lycet", "tests", "Resources", "cert.pem");
  if (!existsSync(rutaCert)) fallar(`cert.pem no encontrado en ${rutaCert}`);
  const certPem = readFileSync(rutaCert, "utf8");
  if (!certPem.includes("-----BEGIN CERTIFICATE-----") || !certPem.includes("-----BEGIN PRIVATE KEY-----")) {
    fallar("cert.pem no contiene certificado y clave privada en PEM");
  }
  // Mismo formato que la UI: texto PEM codificado en base64 (certificadoPemBase64).
  const certBase64 = Buffer.from(certPem, "utf8").toString("base64");

  const { getDb, teams, vatSettings } = await import("../packages/db/src/index.ts");
  const { eq, asc } = await import("drizzle-orm");
  const { cifrar, descifrar } = await import("../apps/web/src/lib/crypto.ts");

  const db = getDb();

  const tenants = await db.select().from(teams).orderBy(asc(teams.createdAt));
  if (tenants.length === 0) {
    fallar("no hay tenants en la BD; ejecuta primero: npm run db:seed -w @clinicflow/db");
  }
  const team = tenants.find((t) => t.slug === "dental") ?? tenants[0]!;
  console.log(
    `[fiscal-demo] tenant: "${team.name}" (slug=${team.slug}, id=${team.id})` +
      (tenants.length > 1 ? ` — elegido entre ${tenants.length} tenants registrados` : ""),
  );

  const [fila] = await db.select().from(vatSettings).where(eq(vatSettings.tenantId, team.id)).limit(1);
  if (
    fila &&
    fila.emision === "electronica" &&
    fila.ruc === RUC_BETA &&
    Boolean(fila.claveSolEnc) &&
    Boolean(fila.certificadoEnc)
  ) {
    console.log(
      `[fiscal-demo] ya configurado: emision=electronica, ruc=${RUC_BETA}, ambiente=${fila.ambiente}, credenciales cifradas presentes. Nada que hacer.`,
    );
    process.exit(0);
  }

  const cambios = {
    razonSocial: RAZON_SOCIAL_BETA,
    regimen: REGIMEN,
    ambiente: AMBIENTE,
    usuarioSol: USUARIO_SOL,
    claveSolEnc: cifrar(CLAVE_SOL),
    certificadoEnc: cifrar(certBase64),
    emision: "electronica" as const,
    emisionAuto: false,
    updatedAt: new Date(),
  };

  // Réplica del PUT /api/vat: insert + onConflictDoUpdate por tenantId.
  // Desviación intencional: el PUT no incluye `ruc` en el set del conflicto
  // (route.ts deja el ruc insertado), lo que conservaría un ruc antiguo; aquí
  // el objetivo es ruc=20161515648, así que se fuerza también en el update.
  await db
    .insert(vatSettings)
    .values({ tenantId: team.id, ruc: RUC_BETA, ...cambios })
    .onConflictDoUpdate({ target: vatSettings.tenantId, set: { ruc: RUC_BETA, ...cambios } });

  const [verificada] = await db
    .select()
    .from(vatSettings)
    .where(eq(vatSettings.tenantId, team.id))
    .limit(1);
  if (!verificada) fallar("no se pudo releer vat_settings tras el upsert");

  let roundTripOk = true;
  try {
    if (descifrar(verificada.claveSolEnc!) !== CLAVE_SOL) {
      roundTripOk = false;
      console.error("[fiscal-demo] round-trip claveSolEnc: el valor descifrado no coincide");
    }
    if (descifrar(verificada.certificadoEnc!) !== certBase64) {
      roundTripOk = false;
      console.error("[fiscal-demo] round-trip certificadoEnc: el base64 descifrado no coincide");
    }
  } catch (e) {
    roundTripOk = false;
    console.error(`[fiscal-demo] round-trip falló: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!roundTripOk) fallar("verificación post-escritura falló (descifrar)");

  console.log(`[fiscal-demo] ${fila ? "actualizada" : "insertada"} vat_settings:`);
  console.log(`  ruc            : ${verificada.ruc}`);
  console.log(`  razonSocial    : ${verificada.razonSocial}`);
  console.log(`  regimen        : ${verificada.regimen}`);
  console.log(`  ambiente       : ${verificada.ambiente}`);
  console.log(`  usuarioSol     : ${verificada.usuarioSol} (el sidecar enviará SOL_USER=${verificada.ruc}${verificada.usuarioSol})`);
  console.log(`  claveSolEnc    : AES-256-GCM ok (${verificada.claveSolEnc!.length} chars base64, round-trip verificado)`);
  console.log(`  certificadoEnc : AES-256-GCM ok (${verificada.certificadoEnc!.length} chars base64, round-trip verificado)`);
  console.log(`  series         : boleta ${verificada.serieBoleta} / factura ${verificada.serieFactura} (defaults del schema)`);
  console.log(`  correlativos   : boleta ${verificada.corrBoleta} / factura ${verificada.corrFactura} (el siguiente número se calcula desde receipts)`);
  console.log(`  emision        : ${verificada.emision} | emisionAuto: ${verificada.emisionAuto}`);

  const lycetUrl = process.env.LYCET_URL ?? "";
  const lycetToken = process.env.LYCET_TOKEN ?? "";
  if (lycetUrl) {
    try {
      const res = await fetch(
        `${lycetUrl}/api/v1/configuration/company/${RUC_BETA}?token=${encodeURIComponent(lycetToken)}`,
        { signal: AbortSignal.timeout(3000) },
      );
      console.log(`[fiscal-demo] sidecar ${lycetUrl}: respondió HTTP ${res.status}`);
    } catch {
      console.log(`[fiscal-demo] sidecar ${lycetUrl}: sin respuesta (no bloqueante, se configura al emitir)`);
    }
  } else {
    console.log("[fiscal-demo] LYCET_URL no definida en .env.local; emitir.ts la requiere para emitir");
  }

  console.log("[fiscal-demo] listo: el tenant demo puede emitir contra SUNAT BETA vía sidecar lycet.");
  process.exit(0);
}

void main();
