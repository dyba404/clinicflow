import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTenantBySlug } from "@/lib/db";
import {
  loginPaciente,
  createPatientSession,
  PATIENT_SESSION_COOKIE,
  patientSessionCookieBase,
} from "@/lib/patient-auth";
import { rateLimit, ipReq } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const limite = rateLimit(`portal-login:${ipReq(req)}`, 10);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  let body: { clinica?: string; celular?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const tenant = body.clinica ? await getTenantBySlug(body.clinica) : null;
  if (!tenant) {
    return NextResponse.json({ error: "clinica_no_encontrada" }, { status: 404 });
  }

  const celular = body.celular?.trim() ?? "";
  const password = body.password ?? "";
  if (!celular || !password) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const r = await loginPaciente({
    tenantId: tenant.teamId,
    identificador: celular,
    password,
    userAgent: req.headers.get("user-agent"),
    ip: ipReq(req),
  });

  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: 401 });
  }

  const sesion = await createPatientSession({
    patientId: r.patientId,
    tenantId: tenant.teamId,
    userAgent: req.headers.get("user-agent"),
    ip: ipReq(req),
  });

  const store = await cookies();
  store.set(PATIENT_SESSION_COOKIE, sesion.token, patientSessionCookieBase(sesion.maxAgeSeconds));

  void logAudit({
    tenantId: tenant.teamId,
    accion: "portal.login",
    entidad: "patients",
    entidadId: r.patientId,
    payload: { via: "password" },
  });

  return NextResponse.json({ ok: true });
}
