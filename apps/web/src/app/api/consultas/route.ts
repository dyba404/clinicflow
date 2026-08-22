import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  getDb,
  consultations,
  consultDiagnoses,
  prescriptions,
  cie10,
  patients,
  appointments,
} from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guardStaff("records.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    patientId?: string;
    appointmentId?: string;
    motivoConsulta?: string;
    subjetivo?: string;
    objetivo?: string;
    evaluacion?: string;
    plan?: string;
    constantes?: Record<string, unknown>;
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

  let appointmentId: string | null = null;
  if (body.appointmentId) {
    const [appt] = await db
      .select({ id: appointments.id, estado: appointments.estado })
      .from(appointments)
      .where(and(eq(appointments.id, body.appointmentId), eq(appointments.tenantId, g.team.id)))
      .limit(1);
    if (appt && appt.estado === "en_atencion") {
      appointmentId = appt.id;
    }
  }

  const [row] = await db
    .insert(consultations)
    .values({
      tenantId: g.team.id,
      patientId: paciente.id,
      appointmentId,
      motivoConsulta: body.motivoConsulta?.trim() || null,
      subjetivo: body.subjetivo?.trim() || null,
      objetivo: body.objetivo?.trim() || null,
      evaluacion: body.evaluacion?.trim() || null,
      plan: body.plan?.trim() || null,
      constantes: body.constantes ?? null,
      doctorMembershipId: g.membership.id,
      creadoPor: g.user.id,
    })
    .returning({ id: consultations.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "consulta.crear",
    entidad: "consultations",
    entidadId: row!.id,
    payload: { patientId: paciente.id, appointmentId },
  });

  return NextResponse.json({ ok: true, id: row!.id }, { status: 201 });
}

export async function GET(req: Request) {
  const g = await guardStaff("records.view");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId");

  const db = getDb();

  const consultas = await db
    .select()
    .from(consultations)
    .where(
      patientId
        ? and(eq(consultations.tenantId, g.team.id), eq(consultations.patientId, patientId))
        : eq(consultations.tenantId, g.team.id),
    )
    .orderBy(desc(consultations.createdAt));

  if (consultas.length === 0) {
    return NextResponse.json({ consultas: [] });
  }

  const ids = consultas.map((c) => c.id);
  const [diagnosticos, recetas] = await Promise.all([
    db
      .select({
        consultationId: consultDiagnoses.consultationId,
        codigo: consultDiagnoses.cie10Codigo,
        descripcion: cie10.descripcion,
        esPrincipal: consultDiagnoses.esPrincipal,
      })
      .from(consultDiagnoses)
      .leftJoin(cie10, eq(consultDiagnoses.cie10Codigo, cie10.codigo))
      .where(inArray(consultDiagnoses.consultationId, ids)),
    db
      .select()
      .from(prescriptions)
      .where(inArray(prescriptions.consultationId, ids)),
  ]);

  const diagPorConsulta = new Map<string, Array<{ codigo: string; descripcion: string | null; esPrincipal: boolean }>>();
  for (const d of diagnosticos) {
    const arr = diagPorConsulta.get(d.consultationId) ?? [];
    arr.push({ codigo: d.codigo, descripcion: d.descripcion, esPrincipal: d.esPrincipal });
    diagPorConsulta.set(d.consultationId, arr);
  }
  const recPorConsulta = new Map<string, Array<(typeof recetas)[number]>>();
  for (const r of recetas) {
    const arr = recPorConsulta.get(r.consultationId) ?? [];
    arr.push(r);
    recPorConsulta.set(r.consultationId, arr);
  }

  return NextResponse.json({
    consultas: consultas.map((c) => ({
      ...c,
      diagnosticos: diagPorConsulta.get(c.id) ?? [],
      recetas: recPorConsulta.get(c.id) ?? [],
    })),
  });
}
