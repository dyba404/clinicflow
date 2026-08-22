import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, clinicalRecords, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { nota?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const nota = body.nota?.trim() ?? "";
  if (nota.length < 1 || nota.length > 2000) {
    return NextResponse.json({ error: "nota_invalida" }, { status: 400 });
  }

  const g = await guardStaff("records.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [paciente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) {
    return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
  }

  const [row] = await db
    .insert(clinicalRecords)
    .values({
      patientId: paciente.id,
      nota,
      createdBy: g.user.id,
    })
    .returning({ id: clinicalRecords.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "nota.clinica",
    entidad: "clinical_records",
    entidadId: row!.id,
  });

  return NextResponse.json({ ok: true, id: row!.id }, { status: 201 });
}
