import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, patients, patientMagicTokens } from "@clinicflow/db";
import { hashPassword } from "@/lib/auth";
import {
  createPatientSession,
  validarPasswordPaciente,
  PATIENT_SESSION_COOKIE,
  patientSessionCookieBase,
} from "@/lib/patient-auth";
import { rateLimit, ipReq } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const limite = rateLimit(`portal-activar:${ipReq(req)}`, 10);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  let body: { password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [tk] = await db
    .select()
    .from(patientMagicTokens)
    .where(
      and(
        eq(patientMagicTokens.token, token),
        eq(patientMagicTokens.tipo, "activacion"),
        isNull(patientMagicTokens.usedAt),
        isNull(patientMagicTokens.revokedAt),
      ),
    )
    .limit(1);

  if (!tk || tk.expiresAt < new Date()) {
    return NextResponse.json({ error: "token_invalido" }, { status: 400 });
  }

  const [paciente] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, tk.patientId))
    .limit(1);
  if (!paciente) {
    return NextResponse.json({ error: "token_invalido" }, { status: 400 });
  }

  const password = body.password ?? "";
  const invalida = validarPasswordPaciente(password, paciente);
  if (invalida) {
    return NextResponse.json({ error: invalida }, { status: 400 });
  }

  const hash = await hashPassword(password);
  await db
    .update(patients)
    .set({ passwordHash: hash, failedAttempts: 0, lockedUntil: null })
    .where(eq(patients.id, paciente.id));

  await db
    .update(patientMagicTokens)
    .set({ usedAt: new Date() })
    .where(eq(patientMagicTokens.id, tk.id));

  const sesion = await createPatientSession({
    patientId: paciente.id,
    tenantId: tk.tenantId,
    userAgent: req.headers.get("user-agent"),
    ip: ipReq(req),
  });
  const store = await cookies();
  store.set(PATIENT_SESSION_COOKIE, sesion.token, patientSessionCookieBase(sesion.maxAgeSeconds));

  void logAudit({
    tenantId: tk.tenantId,
    accion: "portal.activado",
    entidad: "patients",
    entidadId: paciente.id,
    payload: { via: "token_activacion" },
  });

  return NextResponse.json({ ok: true });
}
