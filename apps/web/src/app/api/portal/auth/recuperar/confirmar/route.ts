import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, patients, patientMagicTokens } from "@clinicflow/db";
import { getTenantBySlug } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import {
  verificarOtp,
  validarPasswordPaciente,
  destroyAllPatientSessions,
} from "@/lib/patient-auth";
import { rateLimit, ipReq } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { notificarPaciente } from "@/lib/notificar-paciente";

export async function POST(req: Request) {
  const limite = rateLimit(`portal-recuperar-confirmar:${ipReq(req)}`, 10);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  let body: { clinica?: string; celular?: string; codigo?: string; password?: string };
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
  const codigo = body.codigo?.trim() ?? "";
  const password = body.password ?? "";

  if (!celular || !codigo || !password) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const db = getDb();
  const [paciente] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.tenantId, tenant.teamId), eq(patients.celular, celular)))
    .limit(1);

  if (!paciente || !paciente.passwordHash) {
    return NextResponse.json({ error: "codigo_invalido" }, { status: 400 });
  }

  const otp = await verificarOtp(paciente.id, "recuperar", codigo);
  if (!otp.ok) {
    return NextResponse.json({ error: otp.error }, { status: 400 });
  }

  const invalida = validarPasswordPaciente(password, paciente);
  if (invalida) {
    return NextResponse.json({ error: invalida }, { status: 400 });
  }

  const hash = await hashPassword(password);
  await db
    .update(patients)
    .set({ passwordHash: hash, failedAttempts: 0, lockedUntil: null })
    .where(eq(patients.id, paciente.id));

  await destroyAllPatientSessions(paciente.id);
  await db
    .update(patientMagicTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(patientMagicTokens.patientId, paciente.id),
        eq(patientMagicTokens.tenantId, tenant.teamId),
      ),
    );

  void logAudit({
    tenantId: tenant.teamId,
    accion: "portal.password_cambiado",
    entidad: "patients",
    entidadId: paciente.id,
    payload: { via: "recuperacion_otp" },
  });

  void notificarPaciente({
    tenantId: tenant.teamId,
    celular: paciente.celular,
    email: paciente.email,
    mensajeWhatsApp: `${tenant.name}: tu contraseña del portal fue cambiada. Si no fuiste tú, acércate a recepción con tu DNI.`,
    emailAsunto: `Tu contraseña fue cambiada | ${tenant.name}`,
    emailHtml: `<p>Tu contraseña del portal de paciente fue cambiada.</p><p>Si no fuiste tú, acércate a recepción de ${tenant.name} con tu documento de identidad.</p>`,
    emailTexto: `Tu contraseña del portal fue cambiada.\n\nSi no fuiste tú, acércate a recepción con tu documento de identidad.`,
  });

  return NextResponse.json({ ok: true });
}
