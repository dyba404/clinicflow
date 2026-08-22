import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, patientCoverages, insurers, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

function validarFecha(fecha: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
    !Number.isNaN(new Date(`${fecha}T12:00:00`).getTime())
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("records.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    insurerId?: string;
    plan?: string | null;
    copagoPct?: number | string;
    vigenteDesde?: string | null;
    vigenteHasta?: string | null;
    activo?: boolean;
    notas?: string | null;
    estado?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [actual] = await db
    .select({
      id: patientCoverages.id,
      activo: patientCoverages.activo,
      insurerId: patientCoverages.insurerId,
      patientId: patientCoverages.patientId,
    })
    .from(patientCoverages)
    .innerJoin(insurers, eq(patientCoverages.insurerId, insurers.id))
    .where(and(eq(patientCoverages.id, id), eq(insurers.tenantId, g.team.id)))
    .limit(1);
  if (!actual) {
    return NextResponse.json({ error: "cobertura_no_encontrada" }, { status: 404 });
  }

  const cambios: {
    insurerId?: string;
    plan?: string | null;
    copagoPct?: string;
    vigenteDesde?: string | null;
    vigenteHasta?: string | null;
    activo?: boolean;
    notas?: string | null;
  } = {};

  if (typeof body.estado !== "undefined") {
    if (body.estado === "activa") cambios.activo = true;
    else if (body.estado === "inactiva") cambios.activo = false;
    else return NextResponse.json({ error: "estado_invalido" }, { status: 400 });
  }

  if (typeof body.insurerId !== "undefined") {
    const [aseguradora] = await db
      .select({ id: insurers.id })
      .from(insurers)
      .where(and(eq(insurers.id, body.insurerId), eq(insurers.tenantId, g.team.id)))
      .limit(1);
    if (!aseguradora) {
      return NextResponse.json({ error: "aseguradora_no_encontrada" }, { status: 404 });
    }
    cambios.insurerId = aseguradora.id;
  }

  if (typeof body.plan !== "undefined") {
    if (body.plan === null || !body.plan.trim()) {
      cambios.plan = null;
    } else {
      const plan = body.plan.trim();
      if (plan.length > 120) {
        return NextResponse.json({ error: "plan_invalido" }, { status: 400 });
      }
      cambios.plan = plan;
    }
  }

  if (typeof body.copagoPct !== "undefined") {
    const copagoPct = Number(body.copagoPct);
    if (!Number.isFinite(copagoPct) || copagoPct < 0 || copagoPct > 100) {
      return NextResponse.json({ error: "copago_invalido" }, { status: 400 });
    }
    cambios.copagoPct = copagoPct.toFixed(2);
  }

  if (typeof body.vigenteDesde !== "undefined") {
    if (body.vigenteDesde === null || !body.vigenteDesde) {
      cambios.vigenteDesde = null;
    } else if (!validarFecha(body.vigenteDesde)) {
      return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
    } else {
      cambios.vigenteDesde = body.vigenteDesde;
    }
  }

  if (typeof body.vigenteHasta !== "undefined") {
    if (body.vigenteHasta === null || !body.vigenteHasta) {
      cambios.vigenteHasta = null;
    } else if (!validarFecha(body.vigenteHasta)) {
      return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
    } else {
      cambios.vigenteHasta = body.vigenteHasta;
    }
  }

  if (typeof body.notas !== "undefined") {
    if (body.notas === null || !body.notas.trim()) {
      cambios.notas = null;
    } else {
      const notas = body.notas.trim();
      if (notas.length > 500) {
        return NextResponse.json({ error: "notas_invalida" }, { status: 400 });
      }
      cambios.notas = notas;
    }
  }

  if (typeof body.activo !== "undefined") {
    cambios.activo = Boolean(body.activo);
  }

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: "sin_cambios" }, { status: 400 });
  }

  const [row] = await db
    .update(patientCoverages)
    .set(cambios)
    .where(eq(patientCoverages.id, id))
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
    accion: "cobertura.actualizar",
    entidad: "patient_coverages",
    entidadId: id,
    payload: { patientId: actual.patientId, ...cambios },
  });

  return NextResponse.json({ ok: true, cobertura: row });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("records.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [actual] = await db
    .select({ id: patientCoverages.id, patientId: patientCoverages.patientId })
    .from(patientCoverages)
    .innerJoin(insurers, eq(patientCoverages.insurerId, insurers.id))
    .innerJoin(patients, eq(patientCoverages.patientId, patients.id))
    .where(
      and(
        eq(patientCoverages.id, id),
        eq(insurers.tenantId, g.team.id),
        eq(patients.tenantId, g.team.id),
      ),
    )
    .limit(1);
  if (!actual) {
    return NextResponse.json({ error: "cobertura_no_encontrada" }, { status: 404 });
  }

  const [row] = await db
    .update(patientCoverages)
    .set({ activo: false })
    .where(eq(patientCoverages.id, id))
    .returning({ id: patientCoverages.id, activo: patientCoverages.activo });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "cobertura.desactivar",
    entidad: "patient_coverages",
    entidadId: id,
    payload: { patientId: actual.patientId },
  });

  return NextResponse.json({ ok: true, id: row!.id, activo: row!.activo });
}
