import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, orders, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const TIPOS = ["laboratorio", "imagen"] as const;

export async function GET(req: Request) {
  const g = await guardStaff();
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId");
  const estado = url.searchParams.get("estado");
  const tipo = url.searchParams.get("tipo");

  if (tipo && !TIPOS.includes(tipo as (typeof TIPOS)[number])) {
    return NextResponse.json({ error: "tipo_invalido" }, { status: 400 });
  }

  const condiciones = [eq(orders.tenantId, g.team.id)];
  if (patientId) {
    condiciones.push(eq(orders.patientId, patientId));
  }
  if (estado) {
    condiciones.push(eq(orders.estado, estado as (typeof orders.$inferSelect)["estado"]));
  }
  if (tipo) {
    condiciones.push(eq(orders.tipo, tipo as (typeof TIPOS)[number]));
  }

  const db = getDb();
  const rows = await db
    .select({
      id: orders.id,
      patientId: orders.patientId,
      nombrePaciente: patients.nombre,
      appointmentId: orders.appointmentId,
      consultationId: orders.consultationId,
      tipo: orders.tipo,
      nombre: orders.nombre,
      indicacion: orders.indicacion,
      estado: orders.estado,
      prioridad: orders.prioridad,
      resultado: orders.resultado,
      resultadoAt: orders.resultadoAt,
      motivoRevision: orders.motivoRevision,
      rev: orders.rev,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(patients, eq(orders.patientId, patients.id))
    .where(and(...condiciones))
    .orderBy(desc(orders.prioridad), desc(orders.createdAt));

  return NextResponse.json({ ordenes: rows });
}

export async function POST(req: Request) {
  const g = await guardStaff("labs.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    patientId?: string;
    tipo?: string;
    nombre?: string;
    indicacion?: string;
    prioridad?: number;
    appointmentId?: string;
    consultationId?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (!body.patientId) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }
  const tipo = body.tipo as (typeof TIPOS)[number] | undefined;
  if (!tipo || !TIPOS.includes(tipo)) {
    return NextResponse.json({ error: "tipo_invalido" }, { status: 400 });
  }
  const nombre = body.nombre?.trim() ?? "";
  if (nombre.length < 3) {
    return NextResponse.json({ error: "nombre_invalido" }, { status: 400 });
  }
  let prioridad = 0;
  if (typeof body.prioridad !== "undefined") {
    prioridad = Number(body.prioridad);
    if (!Number.isInteger(prioridad) || prioridad < 0 || prioridad > 10) {
      return NextResponse.json({ error: "prioridad_invalida" }, { status: 400 });
    }
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

  const [row] = await db
    .insert(orders)
    .values({
      tenantId: g.team.id,
      patientId: paciente.id,
      appointmentId: body.appointmentId ?? null,
      consultationId: body.consultationId ?? null,
      tipo,
      nombre,
      indicacion: body.indicacion?.trim() || null,
      prioridad,
      solicitadoPor: g.user.id,
    })
    .returning({ id: orders.id, estado: orders.estado });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "orden.crear",
    entidad: "orders",
    entidadId: row!.id,
    payload: { tipo, nombre, prioridad },
  });

  return NextResponse.json({ ok: true, id: row!.id, estado: row!.estado }, { status: 201 });
}
