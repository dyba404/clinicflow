import { NextResponse } from "next/server";
import { solicitarResena } from "@/lib/reviews";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ERRORES_400 = new Set([
  "ya_solicitada",
  "paciente_sin_email",
  "resenas_no_configuradas",
  "email_no_configurado",
]);

export async function POST(req: Request) {
  const g = await guardStaff("reminders.send");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { patientId?: string; appointmentId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (!body.patientId) {
    return NextResponse.json({ error: "paciente_requerido" }, { status: 400 });
  }

  const r = await solicitarResena({
    tenantId: g.team.id,
    patientId: body.patientId,
    appointmentId: body.appointmentId ?? null,
    canal: "email",
  });

  if (!r.ok) {
    const status = ERRORES_400.has(r.error ?? "") ? 400 : r.error === "paciente_no_encontrado" ? 404 : 502;
    return NextResponse.json({ error: r.error }, { status });
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "resena.solicitar",
    entidad: "review_requests",
    entidadId: r.id,
    payload: { pacienteId: body.patientId, canal: "email" },
  });

  return NextResponse.json({ ok: true, id: r.id });
}
