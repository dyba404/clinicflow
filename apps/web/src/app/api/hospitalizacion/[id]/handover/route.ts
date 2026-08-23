import { NextResponse } from "next/server";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq } from "drizzle-orm";
import {
  getDb,
  admissionHandovers,
  admissions,
  users,
} from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const TURNOS = ["manana", "tarde", "noche"] as const;
type Turno = (typeof TURNOS)[number];

async function obtenerAdmision(id: string, tenantId: string) {
  const [row] = await getDb()
    .select({ id: admissions.id, estado: admissions.estado })
    .from(admissions)
    .where(and(eq(admissions.id, id), eq(admissions.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("hospital.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const admision = await obtenerAdmision(id, g.team.id);
  if (!admision) {
    return NextResponse.json({ error: "admision_no_encontrada" }, { status: 404 });
  }

  const entrega = alias(users, "handover_entrega_u");
  const recibe = alias(users, "handover_recibe_u");

  const rows = await getDb()
    .select({
      id: admissionHandovers.id,
      turno: admissionHandovers.turno,
      resumen: admissionHandovers.resumen,
      pendientes: admissionHandovers.pendientes,
      nombreEntrega: entrega.name,
      nombreRecibe: recibe.name,
      createdAt: admissionHandovers.createdAt,
    })
    .from(admissionHandovers)
    .leftJoin(entrega, eq(admissionHandovers.entregaUserId, entrega.id))
    .leftJoin(recibe, eq(admissionHandovers.recibeUserId, recibe.id))
    .where(
      and(
        eq(admissionHandovers.tenantId, g.team.id),
        eq(admissionHandovers.admissionId, id),
      ),
    )
    .orderBy(desc(admissionHandovers.createdAt));

  return NextResponse.json({ handovers: rows });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("hospital.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    turno?: string;
    resumen?: string;
    pendientes?: string;
    recibeUserId?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const admision = await obtenerAdmision(id, g.team.id);
  if (!admision) {
    return NextResponse.json({ error: "admision_no_encontrada" }, { status: 404 });
  }
  if (admision.estado !== "activa") {
    return NextResponse.json({ error: "admision_no_activa" }, { status: 409 });
  }

  const turno = body.turno as Turno | undefined;
  if (!turno || !(TURNOS as readonly string[]).includes(turno)) {
    return NextResponse.json({ error: "turno_invalido" }, { status: 400 });
  }
  const resumen = body.resumen?.trim() ?? "";
  if (resumen.length < 10) {
    return NextResponse.json({ error: "resumen_invalido" }, { status: 400 });
  }

  let recibeUserId: string | null = null;
  if (body.recibeUserId) {
    const [recibe] = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, body.recibeUserId))
      .limit(1);
    if (!recibe) {
      return NextResponse.json({ error: "usuario_no_encontrado" }, { status: 404 });
    }
    recibeUserId = recibe.id;
  }

  const [row] = await getDb()
    .insert(admissionHandovers)
    .values({
      tenantId: g.team.id,
      admissionId: id,
      turno,
      entregaUserId: g.user.id,
      recibeUserId,
      resumen,
      pendientes: body.pendientes?.trim() || null,
    })
    .returning({ id: admissionHandovers.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "hospitalizacion.handover",
    entidad: "admission_handovers",
    entidadId: row!.id,
    payload: { admissionId: id, turno },
  });

  return NextResponse.json({ ok: true, id: row!.id }, { status: 201 });
}
