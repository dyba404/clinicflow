import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, consultations, prescriptions } from "@clinicflow/db";
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

  let body: Array<{
    medicamento?: string;
    dosis?: string;
    frecuencia?: string;
    duracionDias?: number | string;
    indicaciones?: string;
  }>;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (!Array.isArray(body) || body.length < 1 || body.length > 10) {
    return NextResponse.json({ error: "recetas_invalidas" }, { status: 400 });
  }

  for (const r of body) {
    if (!r.medicamento || r.medicamento.trim().length < 2) {
      return NextResponse.json({ error: "medicamento_invalido" }, { status: 400 });
    }
    if (typeof r.duracionDias !== "undefined") {
      const d = Number(r.duracionDias);
      if (!Number.isInteger(d) || d <= 0 || d > 365) {
        return NextResponse.json({ error: "duracion_invalida" }, { status: 400 });
      }
    }
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

  const rows = await db
    .insert(prescriptions)
    .values(
      body.map((r) => ({
        consultationId: consulta.id,
        medicamento: r.medicamento!.trim(),
        dosis: r.dosis?.trim() || null,
        frecuencia: r.frecuencia?.trim() || null,
        duracionDias:
          typeof r.duracionDias !== "undefined" ? Number(r.duracionDias) : null,
        indicaciones: r.indicaciones?.trim() || null,
      })),
    )
    .returning({ id: prescriptions.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "receta.agregar",
    entidad: "prescriptions",
    payload: { consultationId: consulta.id, cantidad: rows.length },
  });

  return NextResponse.json(
    { ok: true, ids: rows.map((r) => r.id) },
    { status: 201 },
  );
}
