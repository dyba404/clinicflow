import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, consultations, consultDiagnoses } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; codigo: string }> },
) {
  const { id, codigo } = await params;
  const g = await guardStaff("records.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [consulta] = await db
    .select({ id: consultations.id })
    .from(consultations)
    .where(and(eq(consultations.id, id), eq(consultations.tenantId, g.team.id)))
    .limit(1);
  if (!consulta) {
    return NextResponse.json({ error: "consulta_no_encontrada" }, { status: 404 });
  }

  const borrados = await db
    .delete(consultDiagnoses)
    .where(
      and(
        eq(consultDiagnoses.consultationId, consulta.id),
        eq(consultDiagnoses.cie10Codigo, codigo.toUpperCase()),
      ),
    )
    .returning({ id: consultDiagnoses.id });

  if (borrados.length === 0) {
    return NextResponse.json({ error: "diagnostico_no_encontrado" }, { status: 404 });
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "diagnostico.quitar",
    entidad: "consult_diagnoses",
    entidadId: borrados[0]!.id,
    payload: { consultationId: consulta.id, codigo },
  });

  return new NextResponse(null, { status: 204 });
}
