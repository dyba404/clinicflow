import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, patients, patientCoverages, insurers } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

function validarFecha(fecha: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
    !Number.isNaN(new Date(`${fecha}T12:00:00`).getTime())
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("records.view");
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

  const rows = await db
    .select({
      id: patientCoverages.id,
      plan: patientCoverages.plan,
      copagoPct: patientCoverages.copagoPct,
      vigenteDesde: patientCoverages.vigenteDesde,
      vigenteHasta: patientCoverages.vigenteHasta,
      activo: patientCoverages.activo,
      notas: patientCoverages.notas,
      insurerNombre: insurers.nombre,
      createdAt: patientCoverages.createdAt,
    })
    .from(patientCoverages)
    .innerJoin(insurers, eq(patientCoverages.insurerId, insurers.id))
    .where(and(eq(patientCoverages.patientId, id), eq(insurers.tenantId, g.team.id)))
    .orderBy(desc(patientCoverages.createdAt));

  return NextResponse.json({ coberturas: rows });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("records.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    insurerId?: string;
    plan?: string;
    copagoPct?: number | string;
    vigenteDesde?: string;
    vigenteHasta?: string;
    activo?: boolean;
    notas?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (typeof body.insurerId !== "string" || !body.insurerId) {
    return NextResponse.json({ error: "insurer_invalido" }, { status: 400 });
  }

  const plan = body.plan?.trim() ?? "";
  if (plan.length > 120) {
    return NextResponse.json({ error: "plan_invalido" }, { status: 400 });
  }

  let copagoPct = 0;
  if (typeof body.copagoPct !== "undefined") {
    copagoPct = Number(body.copagoPct);
    if (!Number.isFinite(copagoPct) || copagoPct < 0 || copagoPct > 100) {
      return NextResponse.json({ error: "copago_invalido" }, { status: 400 });
    }
  }

  let vigenteDesde: string | null = null;
  if (body.vigenteDesde) {
    if (!validarFecha(body.vigenteDesde)) {
      return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
    }
    vigenteDesde = body.vigenteDesde;
  }

  let vigenteHasta: string | null = null;
  if (body.vigenteHasta) {
    if (!validarFecha(body.vigenteHasta)) {
      return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
    }
    vigenteHasta = body.vigenteHasta;
  }

  if (vigenteDesde && vigenteHasta && vigenteDesde > vigenteHasta) {
    return NextResponse.json({ error: "rango_invalido" }, { status: 400 });
  }

  const notas = body.notas?.trim() ?? "";
  if (notas.length > 500) {
    return NextResponse.json({ error: "notas_invalida" }, { status: 400 });
  }

  const db = getDb();
  const [paciente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) {
    return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
  }

  const [aseguradora] = await db
    .select({ id: insurers.id, nombre: insurers.nombre })
    .from(insurers)
    .where(and(eq(insurers.id, body.insurerId), eq(insurers.tenantId, g.team.id)))
    .limit(1);
  if (!aseguradora) {
    return NextResponse.json({ error: "aseguradora_no_encontrada" }, { status: 404 });
  }

  const [row] = await db
    .insert(patientCoverages)
    .values({
      patientId: paciente.id,
      insurerId: aseguradora.id,
      plan: plan || null,
      copagoPct: copagoPct.toFixed(2),
      vigenteDesde,
      vigenteHasta,
      activo: typeof body.activo === "boolean" ? body.activo : true,
      notas: notas || null,
    })
    .returning({
      id: patientCoverages.id,
      plan: patientCoverages.plan,
      copagoPct: patientCoverages.copagoPct,
      vigenteDesde: patientCoverages.vigenteDesde,
      vigenteHasta: patientCoverages.vigenteHasta,
      activo: patientCoverages.activo,
      notas: patientCoverages.notas,
    });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "cobertura.crear",
    entidad: "patient_coverages",
    entidadId: row!.id,
    payload: { patientId: paciente.id, insurerId: aseguradora.id, copagoPct },
  });

  return NextResponse.json(
    { ok: true, id: row!.id, cobertura: { ...row, insurerNombre: aseguradora.nombre } },
    { status: 201 },
  );
}
