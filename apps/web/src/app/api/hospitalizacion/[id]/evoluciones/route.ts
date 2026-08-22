import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, admissions, evolutions, memberships, users } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

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

  const rows = await getDb()
    .select({
      id: evolutions.id,
      fecha: evolutions.fecha,
      nota: evolutions.nota,
      doctorMembershipId: evolutions.doctorMembershipId,
      nombreDoctor: users.name,
      createdAt: evolutions.createdAt,
    })
    .from(evolutions)
    .leftJoin(memberships, eq(evolutions.doctorMembershipId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(eq(evolutions.admissionId, id))
    .orderBy(desc(evolutions.fecha), desc(evolutions.createdAt));

  return NextResponse.json({ evoluciones: rows });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("hospital.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { fecha?: string; nota?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const admision = await obtenerAdmision(id, g.team.id);
  if (!admision) {
    return NextResponse.json({ error: "admision_no_encontrada" }, { status: 404 });
  }

  const nota = body.nota?.trim() ?? "";
  if (nota.length < 10) {
    return NextResponse.json({ error: "nota_invalida" }, { status: 400 });
  }

  let fecha: string;
  if (body.fecha) {
    if (!FECHA_RE.test(body.fecha)) {
      return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
    }
    fecha = body.fecha;
  } else {
    fecha = new Intl.DateTimeFormat("en-CA", {
      timeZone: g.team.timezone || "America/Lima",
    }).format(new Date());
  }

  const [row] = await getDb()
    .insert(evolutions)
    .values({
      tenantId: g.team.id,
      admissionId: id,
      fecha,
      nota,
      doctorMembershipId: g.membership.role === "doctor" ? g.membership.id : null,
      createdBy: g.user.id,
    })
    .returning({ id: evolutions.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "evolucion.crear",
    entidad: "evolutions",
    entidadId: row!.id,
    payload: { admissionId: id, fecha },
  });

  return NextResponse.json({ ok: true, id: row!.id }, { status: 201 });
}
