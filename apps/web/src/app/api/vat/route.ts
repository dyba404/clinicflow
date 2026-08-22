import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, vatSettings } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { cifrar, masterKeyConfigurada } from "@/lib/crypto";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

type CuerpoVat = {
  ruc?: string;
  razonSocial?: string;
  regimen?: string;
  ambiente?: string;
  claveSol?: string;
  usuarioSol?: string;
  certificadoPemBase64?: string;
  emision?: string;
  emisionAuto?: boolean;
};

export async function GET() {
  const g = await guardStaff("vat.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "facturacion");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const [config] = await getDb()
    .select()
    .from(vatSettings)
    .where(eq(vatSettings.tenantId, g.team.id))
    .limit(1);

  return NextResponse.json({
    settings: config
      ? {
          ruc: config.ruc,
          razonSocial: config.razonSocial,
          regimen: config.regimen,
          ambiente: config.ambiente,
          usuarioSol: config.usuarioSol,
          claveSolConfigurada: Boolean(config.claveSolEnc),
          certificadoConfigurado: Boolean(config.certificadoEnc),
          serieBoleta: config.serieBoleta,
          serieFactura: config.serieFactura,
          corrBoleta: config.corrBoleta,
          corrFactura: config.corrFactura,
          emision: config.emision,
          emisionAuto: config.emisionAuto,
        }
      : null,
    masterKeyConfigurada: masterKeyConfigurada(),
  });
}

export async function PUT(req: Request) {
  const g = await guardStaff("vat.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "facturacion");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: CuerpoVat;
  try {
    body = (await req.json()) as CuerpoVat;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const ruc = body.ruc?.trim();
  if (!ruc || !/^\d{11}$/.test(ruc)) {
    return NextResponse.json({ error: "ruc_invalido" }, { status: 400 });
  }

  const necesitaCifrado =
    typeof body.claveSol === "string" ||
    typeof body.certificadoPemBase64 === "string";
  if (necesitaCifrado && !masterKeyConfigurada()) {
    return NextResponse.json({ error: "master_key_no_configurada" }, { status: 503 });
  }

  const cambios: {
    razonSocial?: string;
    regimen?: "RUS" | "RER" | "MYPE";
    ambiente?: string;
    usuarioSol?: string;
    claveSolEnc?: string;
    certificadoEnc?: string;
    emision?: "manual" | "electronica";
    emisionAuto?: boolean;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (typeof body.razonSocial === "string") cambios.razonSocial = body.razonSocial.trim();
  if (body.regimen === "RUS" || body.regimen === "RER" || body.regimen === "MYPE") {
    cambios.regimen = body.regimen;
  }
  if (body.ambiente === "beta" || body.ambiente === "produccion") {
    cambios.ambiente = body.ambiente;
  }
  if (body.emision === "manual" || body.emision === "electronica") {
    cambios.emision = body.emision;
  }
  if (typeof body.emisionAuto === "boolean") {
    cambios.emisionAuto = body.emisionAuto;
  }
  if (typeof body.usuarioSol === "string" && body.usuarioSol.trim().length > 0) {
    cambios.usuarioSol = body.usuarioSol.trim();
  }
  if (typeof body.claveSol === "string" && body.claveSol.length > 0) {
    cambios.claveSolEnc = cifrar(body.claveSol);
  }
  if (typeof body.certificadoPemBase64 === "string" && body.certificadoPemBase64.length > 0) {
    cambios.certificadoEnc = cifrar(body.certificadoPemBase64);
  }

  await getDb()
    .insert(vatSettings)
    .values({
      tenantId: g.team.id,
      ruc,
      ...cambios,
    })
    .onConflictDoUpdate({ target: vatSettings.tenantId, set: cambios });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "fiscal.configurar",
    entidad: "vat_settings",
    entidadId: g.team.id,
    payload: {
      ruc,
      regimen: cambios.regimen ?? null,
      ambiente: cambios.ambiente ?? null,
      emision: cambios.emision ?? null,
      emisionAuto: cambios.emisionAuto ?? null,
      claveSol: cambios.claveSolEnc !== undefined,
      certificado: cambios.certificadoEnc !== undefined,
      usuarioSol: cambios.usuarioSol ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
