import { NextResponse } from "next/server";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  getDb,
  memberships,
  patients,
  surgeries,
  surgeryRooms,
  users,
} from "@clinicflow/db";
import { guardStaff, guardError, hoyTenant } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ESTADOS = ["programada", "intra", "urpa", "completada", "cancelada"] as const;
type Estado = (typeof ESTADOS)[number];

const ASA_RE = /^I{1,3}(V|VI)?$/;

function rangoDia(fecha: string): { desde: Date; hasta: Date } {
  const desde = new Date(`${fecha}T00:00:00`);
  return { desde, hasta: new Date(desde.getTime() + 24 * 3600_000) };
}

async function salaOcupada(opts: {
  tenantId: string;
  roomId: string;
  desde: Date;
  hasta: Date;
}): Promise<boolean> {
  const [choque] = await getDb()
    .select({ id: surgeries.id })
    .from(surgeries)
    .where(
      and(
        eq(surgeries.tenantId, opts.tenantId),
        eq(surgeries.roomId, opts.roomId),
        inArray(surgeries.estado, ["programada", "intra", "urpa"]),
        gte(surgeries.scheduledAt, opts.desde),
        lt(surgeries.scheduledAt, opts.hasta),
      ),
    )
    .limit(1);
  return Boolean(choque);
}

async function validarDoctor(tenantId: string, membershipId: string): Promise<boolean> {
  const [fila] = await getDb()
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.id, membershipId),
        eq(memberships.teamId, tenantId),
        eq(memberships.role, "doctor"),
        eq(memberships.active, true),
      ),
    )
    .limit(1);
  return Boolean(fila);
}

export async function GET(req: Request) {
  const g = await guardStaff("surgery.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const url = new URL(req.url);
  const fecha = url.searchParams.get("fecha") ?? (await hoyTenant(g.team.timezone));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
  }
  const estado = url.searchParams.get("estado") as Estado | null;
  if (estado && !ESTADOS.includes(estado)) {
    return NextResponse.json({ error: "estado_invalido" }, { status: 400 });
  }

  const db = getDb();
  const salas = await db
    .select({ id: surgeryRooms.id, nombre: surgeryRooms.nombre, activo: surgeryRooms.activo })
    .from(surgeryRooms)
    .where(eq(surgeryRooms.tenantId, g.team.id));

  const cirujanoM = alias(memberships, "quirofano_cirujano_m");
  const anestM = alias(memberships, "quirofano_anest_m");
  const cirujanoU = alias(users, "quirofano_cirujano_u");
  const anestU = alias(users, "quirofano_anest_u");

  const { desde, hasta } = rangoDia(fecha);
  const filas = await db
    .select({
      id: surgeries.id,
      patientId: surgeries.patientId,
      nombrePaciente: patients.nombre,
      roomId: surgeries.roomId,
      nombreSala: surgeryRooms.nombre,
      scheduledAt: surgeries.scheduledAt,
      procedimiento: surgeries.procedimiento,
      cirujanoMembershipId: surgeries.cirujanoMembershipId,
      anestesiologoMembershipId: surgeries.anestesiologoMembershipId,
      cirujanoNombre: cirujanoU.name,
      anestesiologoNombre: anestU.name,
      asaClase: surgeries.asaClase,
      estado: surgeries.estado,
      checklistPreop: surgeries.checklistPreop,
      anestesiaTipo: surgeries.anestesiaTipo,
      anestesiaNotas: surgeries.anestesiaNotas,
      inicioAt: surgeries.inicioAt,
      finAt: surgeries.finAt,
      equipo: surgeries.equipo,
      complicaciones: surgeries.complicaciones,
      urpaNotas: surgeries.urpaNotas,
      canceladaMotivo: surgeries.canceladaMotivo,
    })
    .from(surgeries)
    .innerJoin(patients, eq(surgeries.patientId, patients.id))
    .leftJoin(surgeryRooms, eq(surgeries.roomId, surgeryRooms.id))
    .leftJoin(cirujanoM, eq(surgeries.cirujanoMembershipId, cirujanoM.id))
    .leftJoin(cirujanoU, eq(cirujanoM.userId, cirujanoU.id))
    .leftJoin(anestM, eq(surgeries.anestesiologoMembershipId, anestM.id))
    .leftJoin(anestU, eq(anestM.userId, anestU.id))
    .where(
      and(
        eq(surgeries.tenantId, g.team.id),
        gte(surgeries.scheduledAt, desde),
        lt(surgeries.scheduledAt, hasta),
        estado ? eq(surgeries.estado, estado) : undefined,
      ),
    );

  return NextResponse.json({
    salas,
    cirugias: filas.map((f) => ({
      ...f,
      cirujanoNombre: f.cirujanoNombre ?? null,
      anestesiologoNombre: f.anestesiologoNombre ?? null,
      nombreSala: f.nombreSala ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const g = await guardStaff("surgery.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    patientId?: string;
    procedimiento?: string;
    scheduledAt?: string;
    roomId?: string | null;
    cirujanoMembershipId?: string | null;
    anestesiologoMembershipId?: string | null;
    asaClase?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const procedimiento = body.procedimiento?.trim() ?? "";
  if (procedimiento.length < 3) {
    return NextResponse.json({ error: "procedimiento_invalido" }, { status: 400 });
  }
  if (!body.patientId) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const programadaAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date(NaN);
  if (Number.isNaN(programadaAt.getTime())) {
    return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
  }
  const hoy = await hoyTenant(g.team.timezone);
  const { desde } = rangoDia(hoy);
  if (programadaAt.getTime() < desde.getTime()) {
    return NextResponse.json({ error: "fecha_pasada" }, { status: 400 });
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

  let roomId: string | null = null;
  if (body.roomId) {
    const [sala] = await db
      .select({ id: surgeryRooms.id, activo: surgeryRooms.activo })
      .from(surgeryRooms)
      .where(and(eq(surgeryRooms.id, body.roomId), eq(surgeryRooms.tenantId, g.team.id)))
      .limit(1);
    if (!sala || !sala.activo) {
      return NextResponse.json({ error: "sala_no_encontrada" }, { status: 404 });
    }
    const ocupada = await salaOcupada({
      tenantId: g.team.id,
      roomId: sala.id,
      desde: new Date(programadaAt.getTime() - 30 * 60_000),
      hasta: new Date(programadaAt.getTime() + 30 * 60_000),
    });
    if (ocupada) {
      return NextResponse.json({ error: "sala_no_disponible" }, { status: 409 });
    }
    roomId = sala.id;
  }

  let cirujanoMembershipId: string | null = null;
  if (body.cirujanoMembershipId) {
    if (!(await validarDoctor(g.team.id, body.cirujanoMembershipId))) {
      return NextResponse.json({ error: "cirujano_invalido" }, { status: 404 });
    }
    cirujanoMembershipId = body.cirujanoMembershipId;
  }

  let anestesiologoMembershipId: string | null = null;
  if (body.anestesiologoMembershipId) {
    if (!(await validarDoctor(g.team.id, body.anestesiologoMembershipId))) {
      return NextResponse.json({ error: "anestesiologo_invalido" }, { status: 404 });
    }
    anestesiologoMembershipId = body.anestesiologoMembershipId;
  }

  let asaClase: string | null = null;
  if (typeof body.asaClase === "string" && body.asaClase.trim()) {
    const v = body.asaClase.trim().toUpperCase();
    if (v.length > 8 && !ASA_RE.test(v)) {
      return NextResponse.json({ error: "asa_invalido" }, { status: 400 });
    }
    asaClase = v.slice(0, 8);
  }

  const [row] = await db
    .insert(surgeries)
    .values({
      tenantId: g.team.id,
      patientId: paciente.id,
      roomId,
      scheduledAt: programadaAt,
      procedimiento: procedimiento.slice(0, 200),
      cirujanoMembershipId,
      anestesiologoMembershipId,
      asaClase,
      createdBy: g.user.id,
    })
    .returning({ id: surgeries.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "cirugia.programar",
    entidad: "surgeries",
    entidadId: row!.id,
    payload: {
      patientId: paciente.id,
      roomId,
      scheduledAt: programadaAt.toISOString(),
      cirujanoMembershipId,
      anestesiologoMembershipId,
      asaClase,
    },
  });

  return NextResponse.json({ id: row!.id }, { status: 201 });
}
