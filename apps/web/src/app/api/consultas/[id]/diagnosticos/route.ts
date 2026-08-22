import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, consultations, consultDiagnoses, cie10 } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("records.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { codigo?: string; esPrincipal?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const codigo = body.codigo?.trim().toUpperCase() ?? "";
  if (!codigo) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const db = getDb();
  const [consulta] = await db
    .select({ id: consultations.id })
    .from(consultations)
    .where(and(eq(consultations.id, id), eq(consultations.tenantId, g.team.id)))
    .limit(1);
  if (!consulta) {
    return NextResponse.json({ error: "consulta_no_encontrada" }, { status: 404 });
  }

  const [cie] = await db
    .select({ codigo: cie10.codigo })
    .from(cie10)
    .where(eq(cie10.codigo, codigo))
    .limit(1);
  if (!cie) {
    return NextResponse.json({ error: "codigo_cie10_invalido" }, { status: 404 });
  }

  const esPrincipal = body.esPrincipal ?? false;
  if (esPrincipal) {
    await db
      .update(consultDiagnoses)
      .set({ esPrincipal: false })
      .where(eq(consultDiagnoses.consultationId, consulta.id));
  }

  let row;
  try {
    [row] = await db
      .insert(consultDiagnoses)
      .values({
        consultationId: consulta.id,
        cie10Codigo: codigo,
        esPrincipal,
      })
      .returning({ id: consultDiagnoses.id });
  } catch (e) {
    if (e instanceof Error && /consult_diagnoses_consult_cie10_key/i.test(e.message)) {
      if (!esPrincipal) {
        return NextResponse.json({ error: "diagnostico_ya_registrado" }, { status: 409 });
      }
      [row] = await db
        .update(consultDiagnoses)
        .set({ esPrincipal: true })
        .where(
          and(
            eq(consultDiagnoses.consultationId, consulta.id),
            eq(consultDiagnoses.cie10Codigo, codigo),
          ),
        )
        .returning({ id: consultDiagnoses.id });
      return NextResponse.json({ ok: true, id: row!.id });
    }
    throw e;
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "diagnostico.agregar",
    entidad: "consult_diagnoses",
    entidadId: row!.id,
    payload: { consultationId: consulta.id, codigo, esPrincipal },
  });

  return NextResponse.json({ ok: true, id: row!.id }, { status: 201 });
}
