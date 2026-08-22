import { NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  getDb,
  icuStays,
  patients,
  admissions,
  patientCoverages,
  insurers,
} from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guardStaff("icu.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const url = new URL(req.url);
  const incluirHistorial = url.searchParams.get("historial") === "1";

  const db = getDb();
  const rows = await db
    .select({
      id: icuStays.id,
      patientId: icuStays.patientId,
      nombrePaciente: patients.nombre,
      admissionId: icuStays.admissionId,
      ingresoAt: icuStays.ingresoAt,
      egresoAt: icuStays.egresoAt,
      balanceHidrico: icuStays.balanceHidrico,
      notas: icuStays.notas,
    })
    .from(icuStays)
    .innerJoin(patients, eq(icuStays.patientId, patients.id))
    .where(
      incluirHistorial
        ? eq(icuStays.tenantId, g.team.id)
        : and(eq(icuStays.tenantId, g.team.id), isNull(icuStays.egresoAt)),
    )
    .orderBy(desc(icuStays.ingresoAt));

  const idsPaciente = [...new Set(rows.map((r) => r.patientId))];
  const coberturaPorPaciente = new Map<string, string>();
  if (idsPaciente.length > 0) {
    const coberturas = await db
      .select({
        patientId: patientCoverages.patientId,
        nombre: insurers.nombre,
        createdAt: patientCoverages.createdAt,
      })
      .from(patientCoverages)
      .innerJoin(insurers, eq(patientCoverages.insurerId, insurers.id))
      .where(and(inArray(patientCoverages.patientId, idsPaciente), eq(patientCoverages.activo, true)))
      .orderBy(desc(patientCoverages.createdAt));
    for (const c of coberturas) {
      if (!coberturaPorPaciente.has(c.patientId)) coberturaPorPaciente.set(c.patientId, c.nombre);
    }
  }

  return NextResponse.json({
    estancias: rows.map((r) => ({
      ...r,
      cobertura: coberturaPorPaciente.get(r.patientId) ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const g = await guardStaff("icu.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    patientId?: string;
    admissionId?: string;
    notas?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (!body.patientId) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const db = getDb();
  const [paciente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, body.patientId), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) {
    return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
  }

  let admissionId: string | null = null;
  if (body.admissionId) {
    const [admision] = await db
      .select({ id: admissions.id })
      .from(admissions)
      .where(
        and(
          eq(admissions.id, body.admissionId),
          eq(admissions.tenantId, g.team.id),
          eq(admissions.estado, "activa"),
        ),
      )
      .limit(1);
    if (!admision) {
      return NextResponse.json({ error: "admision_no_encontrada" }, { status: 404 });
    }
    admissionId = admision.id;
  }

  const [activa] = await db
    .select({ id: icuStays.id })
    .from(icuStays)
    .where(
      and(
        eq(icuStays.tenantId, g.team.id),
        eq(icuStays.patientId, paciente.id),
        isNull(icuStays.egresoAt),
      ),
    )
    .limit(1);
  if (activa) {
    return NextResponse.json({ error: "uci_ya_activa" }, { status: 409 });
  }

  const notas = body.notas?.trim() || null;

  const [row] = await db
    .insert(icuStays)
    .values({
      tenantId: g.team.id,
      patientId: paciente.id,
      admissionId,
      notas,
      createdBy: g.user.id,
    })
    .returning({ id: icuStays.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "uci.ingreso",
    entidad: "icu_stays",
    entidadId: row!.id,
    payload: { patientId: paciente.id, admissionId, notas },
  });

  return NextResponse.json({ id: row!.id }, { status: 201 });
}
