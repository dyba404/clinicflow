import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, patients } from "@clinicflow/db";
import { getTenantBySlug } from "@/lib/db";
import { generarOtp } from "@/lib/patient-auth";
import { rateLimit, ipReq } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { notificarPaciente } from "@/lib/notificar-paciente";

export async function POST(req: Request) {
  const limite = rateLimit(`portal-recuperar:${ipReq(req)}`, 5);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  let body: { clinica?: string; celular?: string; documento?: string; fnac?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const tenant = body.clinica ? await getTenantBySlug(body.clinica) : null;
  if (!tenant) {
    return NextResponse.json({ error: "clinica_no_encontrada" }, { status: 404 });
  }

  const celular = body.celular?.trim().replace(/\s+/g, "") ?? "";
  const documento = body.documento?.trim() ?? "";
  const fnac = body.fnac?.trim() ?? "";

  if (!celular || !documento || !fnac) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fnac)) {
    return NextResponse.json({ error: "fnac_invalida" }, { status: 400 });
  }

  const db = getDb();
  const [paciente] = await db
    .select()
    .from(patients)
    .where(
      and(
        eq(patients.tenantId, tenant.teamId),
        eq(patients.celular, celular),
        eq(patients.documento, documento),
        eq(patients.fnac, fnac),
      ),
    )
    .limit(1);

  if (!paciente || !paciente.passwordHash) {
    return NextResponse.json({ ok: true });
  }

  const codigo = await generarOtp(paciente.id, "recuperar");
  const primerNombre = paciente.nombre.split(" ")[0] ?? paciente.nombre;

  await notificarPaciente({
    tenantId: tenant.teamId,
    celular: paciente.celular,
    email: paciente.email,
    mensajeWhatsApp: `${tenant.name}: tu código de recuperación es ${codigo}. Vence en 10 minutos. Si no lo pediste, ignora este mensaje.`,
    emailAsunto: `${codigo} — código de recuperación | ${tenant.name}`,
    emailHtml: `<p>Hola ${primerNombre}, tu código de recuperación de ${tenant.name} es:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px;">${codigo}</p><p>Vence en 10 minutos. Si no lo solicitaste, ignora este correo.</p>`,
    emailTexto: `Hola ${primerNombre},\n\nTu código de recuperación es: ${codigo}\n\nVence en 10 minutos.`,
  });

  void logAudit({
    tenantId: tenant.teamId,
    accion: "portal.recuperar_solicitado",
    entidad: "patients",
    entidadId: paciente.id,
    payload: { ip: ipReq(req) },
  });

  return NextResponse.json({ ok: true });
}
