import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { hasPermission } from "@clinicflow/core";
import { getDb, consultDiagnoses, consultations } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; codigo: string }> },
) {
  const { id, codigo } = await params;
  const g = await guardStaff();
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { ocultoPortal?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (typeof body.ocultoPortal !== "boolean") {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const db = getDb();
  const [consulta] = await db
    .select({ id: consultations.id, creadoPor: consultations.creadoPor })
    .from(consultations)
    .where(and(eq(consultations.id, id), eq(consultations.tenantId, g.team.id)))
    .limit(1);
  if (!consulta) {
    return NextResponse.json({ error: "consulta_no_encontrada" }, { status: 404 });
  }

  if (!hasPermission(g.membership.role, "records.edit") && consulta.creadoPor !== g.user.id) {
    return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
  }

  const [diag] = await db
    .select({ id: consultDiagnoses.id })
    .from(consultDiagnoses)
    .where(
      and(
        eq(consultDiagnoses.consultationId, consulta.id),
        eq(consultDiagnoses.cie10Codigo, codigo.toUpperCase()),
      ),
    )
    .limit(1);
  if (!diag) {
    return NextResponse.json({ error: "diagnostico_no_encontrado" }, { status: 404 });
  }

  await db
    .update(consultDiagnoses)
    .set({ ocultoPortal: body.ocultoPortal })
    .where(eq(consultDiagnoses.id, diag.id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "diagnostico.portal",
    entidad: "consult_diagnoses",
    entidadId: diag.id,
    payload: { ocultoPortal: body.ocultoPortal, codigo },
  });

  return NextResponse.json({ ok: true });
}
