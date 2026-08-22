import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, appointments } from "@clinicflow/db";
import { resolvePortalToken } from "@/lib/magic-link";
import { rateLimit, ipReq } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const limite = rateLimit(`portal:confirmar:${token}:${ipReq(req)}`, 6);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  const r = await resolvePortalToken(token);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 404 });
  const { ctx } = r;

  let body: { citaId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (!body.citaId || typeof body.citaId !== "string") {
    return NextResponse.json({ error: "citaId_requerido" }, { status: 400 });
  }

  const db = getDb();
  const [cita] = await db
    .select({
      id: appointments.id,
      fecha: appointments.fecha,
      estado: appointments.estado,
      createdAt: appointments.createdAt,
      servicioId: appointments.serviceId,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.id, body.citaId),
        eq(appointments.tenantId, ctx.team.id),
        eq(appointments.patientId, ctx.patient.id),
      ),
    )
    .limit(1);

  if (!cita) {
    return NextResponse.json({ error: "cita_no_encontrada" }, { status: 404 });
  }

  if (cita.estado === "solicitada") {
    await db
      .update(appointments)
      .set({ estado: "confirmada", updatedAt: new Date() })
      .where(eq(appointments.id, cita.id));

    void logAudit({
      tenantId: ctx.team.id,
      accion: "cita.confirmar_paciente",
      entidad: "citas",
      entidadId: cita.id,
      payload: { via: "portal_paciente", de: "solicitada" },
    });

    return NextResponse.json({ ok: true, estado: "confirmada" });
  }

  if (cita.estado === "confirmada") {
    return NextResponse.json({ ok: true, estado: "confirmada", yaConfirmada: true });
  }

  return NextResponse.json(
    { error: "no_se_puede_confirmar_asistencia" },
    { status: 409 },
  );
}
