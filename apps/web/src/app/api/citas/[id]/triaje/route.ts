import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, appointments } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

const TRIAJES = ["leve", "moderado", "urgente"] as const;
type TriajeNivel = (typeof TRIAJES)[number];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let nivel: TriajeNivel | null;
  let nota: string | undefined;
  try {
    const body = (await req.json()) as { nivel?: unknown; nota?: unknown };
    nivel = body.nivel as TriajeNivel | null;
    nota = typeof body.nota === "string" ? body.nota : undefined;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (nivel !== null && !TRIAJES.includes(nivel)) {
    return NextResponse.json({ error: "nivel_invalido" }, { status: 400 });
  }
  if (nota !== undefined && nota.trim().length < 3) {
    return NextResponse.json({ error: "nota_invalida" }, { status: 400 });
  }

  const g = await guardStaff("checkin.perform");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [appt] = await db
    .select({
      id: appointments.id,
      estado: appointments.estado,
      tenantId: appointments.tenantId,
      doctorId: appointments.doctorId,
    })
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);
  if (!appt || appt.tenantId !== g.team.id) {
    return NextResponse.json({ error: "no_encontrada" }, { status: 404 });
  }

  if (g.membership.role === "doctor" && appt.doctorId !== g.membership.id) {
    return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
  }

  if (appt.estado !== "en_espera") {
    return NextResponse.json({ error: "estado_invalido_para_triaje" }, { status: 409 });
  }

  await db
    .update(appointments)
    .set({
      triageNivel: nivel,
      triajeAt: nivel ? new Date() : null,
      triajePor: nivel ? g.user.id : null,
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "cita.triaje",
    entidad: "citas",
    entidadId: id,
    payload: { nivel, nota: nota ?? null },
  });

  return NextResponse.json({ ok: true, nivel });
}
