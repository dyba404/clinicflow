import { NextResponse } from "next/server";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { dirname } from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { getDb, vatSettings } from "@clinicflow/db";
import { eq } from "drizzle-orm";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";
import { logoComprobantePath } from "@/lib/comprobante-pdf";
import {
  lycetConfigurado,
  lycetMensajeError,
  lycetSubirLogo,
  lycetEliminarLogo,
} from "@/lib/lycet";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;

export async function GET() {
  const g = await guardStaff("receipts.issue");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "facturacion");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let bytes: Uint8Array;
  try {
    bytes = await readFile(logoComprobantePath(g.team.id));
  } catch {
    return NextResponse.json({ error: "logo_no_configurado" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const g = await guardStaff("receipts.issue");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "facturacion");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: { logoBase64?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const sinPrefijo = (body.logoBase64 ?? "").replace(/^data:image\/[a-zA-Z+.-]+;base64,/, "");
  let buffer: Uint8Array;
  try {
    buffer = Uint8Array.from(Buffer.from(sinPrefijo, "base64"));
  } catch {
    return NextResponse.json({ error: "logo_invalido" }, { status: 400 });
  }
  if (buffer.length === 0) {
    return NextResponse.json({ error: "logo_requerido" }, { status: 400 });
  }
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: "logo_muy_grande" }, { status: 413 });
  }
  const type = await fileTypeFromBuffer(buffer);
  if (!type || type.mime !== "image/png") {
    return NextResponse.json({ error: "logo_debe_ser_png" }, { status: 415 });
  }

  const ruta = logoComprobantePath(g.team.id);
  await mkdir(dirname(ruta), { recursive: true });
  await writeFile(ruta, buffer);

  let enviadoSidecar = false;
  let mensajeSidecar: string | null = null;
  const db = getDb();
  const [config] = await db
    .select({ ruc: vatSettings.ruc })
    .from(vatSettings)
    .where(eq(vatSettings.tenantId, g.team.id))
    .limit(1);
  if (lycetConfigurado() && config?.ruc) {
    try {
      const res = await lycetSubirLogo(config.ruc, Buffer.from(buffer).toString("base64"));
      enviadoSidecar = res.ok;
      if (!res.ok) mensajeSidecar = lycetMensajeError(res.status, res.body);
    } catch {
      enviadoSidecar = false;
    }
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "comprobante.logo",
    entidad: "receipts",
    payload: { size: buffer.length, enviadoSidecar },
  });

  return NextResponse.json({ ok: true, enviadoSidecar, mensajeSidecar });
}

export async function DELETE() {
  const g = await guardStaff("receipts.issue");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "facturacion");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const ruta = logoComprobantePath(g.team.id);
  await rm(ruta, { force: true });

  const db = getDb();
  const [config] = await db
    .select({ ruc: vatSettings.ruc })
    .from(vatSettings)
    .where(eq(vatSettings.tenantId, g.team.id))
    .limit(1);
  if (lycetConfigurado() && config?.ruc) {
    try {
      await lycetEliminarLogo(config.ruc);
    } catch {
      void 0;
    }
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "comprobante.logo_eliminar",
    entidad: "receipts",
    payload: {},
  });

  return NextResponse.json({ ok: true });
}
