import { NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  getDb,
  admissions,
  bedAssignments,
  beds,
  patients,
  consultations,
} from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const TIPOS = ["emergencia", "observacion", "internamiento"] as const;
type Tipo = (typeof TIPOS)[number];


export async function GET(req: Request) {
  const g = await guardStaff("hospital.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const url = new URL(req.url);
  const soloActivas = url.searchParams.get("activas") === "1";

  const db = getDb();
  const rows = await db
    .select({
      id: admissions.id,
      patientId: admissions.patientId,
      nombrePaciente: patients.nombre,
      consultationId: admissions.consultationId,
      tipo: admissions.tipo,
      motivo: admissions.motivo,
      estado: admissions.estado,
      admittedAt: admissions.admittedAt,
      dischargedAt: admissions.dischargedAt,
      altaTipo: admissions.altaTipo,
      epicrisis: admissions.epicrisis,
    })
    .from(admissions)
    .innerJoin(patients, eq(admissions.patientId, patients.id))
    .where(
      soloActivas
        ? and(eq(admissions.tenantId, g.team.id), eq(admissions.estado, "activa"))
        : eq(admissions.tenantId, g.team.id),
    )
    .orderBy(
      sql`case when ${admissions.estado} = 'activa' then 0 else 1 end`,
      desc(admissions.admittedAt),
    );

  const ids = rows.map((r) => r.id);
  const camaPorAdmision = new Map<string, string>();
  if (ids.length > 0) {
    const asignaciones = await db
      .select({
        admissionId: bedAssignments.admissionId,
        nombreCama: beds.nombre,
      })
      .from(bedAssignments)
      .innerJoin(beds, eq(bedAssignments.bedId, beds.id))
      .where(and(inArray(bedAssignments.admissionId, ids), isNull(bedAssignments.hasta)));
    for (const a of asignaciones) {
      camaPorAdmision.set(a.admissionId, a.nombreCama);
    }
  }

  return NextResponse.json({
    admisiones: rows.map((r) => ({ ...r, cama: camaPorAdmision.get(r.id) ?? null })),
  });
}

export async function POST(req: Request) {
  const g = await guardStaff("hospital.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    patientId?: string;
    tipo?: string;
    motivo?: string;
    consulta?: string;
    cama?: string;
    admision?: { motivo?: string; tipo?: string; clinica?: string };
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const tipo = (body.admision?.tipo ?? body.tipo) as Tipo | undefined;
  if (!tipo || !TIPOS.includes(tipo)) {
    return NextResponse.json({ error: "tipo_invalido" }, { status: 400 });
  }
  const motivo = (body.admision?.motivo ?? body.motivo ?? "").trim();
  if (motivo.length < 3) {
    return NextResponse.json({ error: "motivo_invalido" }, { status: 400 });
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

  let consultationId: string | null = null;
  if (body.consulta) {
    const [consulta] = await db
      .select({ id: consultations.id })
      .from(consultations)
      .where(and(eq(consultations.id, body.consulta), eq(consultations.tenantId, g.team.id)))
      .limit(1);
    if (!consulta) {
      return NextResponse.json({ error: "consulta_no_encontrada" }, { status: 404 });
    }
    consultationId = consulta.id;
  }

  const [activa] = await db
    .select({ id: admissions.id })
    .from(admissions)
    .where(
      and(
        eq(admissions.tenantId, g.team.id),
        eq(admissions.patientId, paciente.id),
        eq(admissions.estado, "activa"),
      ),
    )
    .limit(1);
  if (activa) {
    return NextResponse.json({ error: "admision_ya_activa" }, { status: 409 });
  }

  const camaId = body.cama?.trim() || null;
  if (camaId) {
    const [cama] = await db
      .select({ id: beds.id, estado: beds.estado })
      .from(beds)
      .where(and(eq(beds.id, camaId), eq(beds.tenantId, g.team.id)))
      .limit(1);
    if (!cama) {
      return NextResponse.json({ error: "cama_no_encontrada" }, { status: 404 });
    }
    if (cama.estado !== "libre") {
      return NextResponse.json({ error: "cama_no_disponible" }, { status: 409 });
    }
  }

  const [row] = await db
    .insert(admissions)
    .values({
      tenantId: g.team.id,
      patientId: paciente.id,
      consultationId,
      tipo,
      motivo,
      admittedById: g.user.id,
    })
    .returning({ id: admissions.id });

  if (camaId) {
    await db.transaction(async (tx) => {
      await tx.insert(bedAssignments).values({ admissionId: row!.id, bedId: camaId });
      await tx.update(beds).set({ estado: "ocupada" }).where(eq(beds.id, camaId));
    });
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "hospitalizacion.ingreso",
    entidad: "admissions",
    entidadId: row!.id,
    payload: { patientId: paciente.id, tipo, consulta: consultationId, camaId },
  });

  return NextResponse.json({ id: row!.id }, { status: 201 });
}
