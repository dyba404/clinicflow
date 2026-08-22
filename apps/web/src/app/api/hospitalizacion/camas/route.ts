import { NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb, beds, bedAssignments, admissions, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const TIPOS = ["cama", "sillon", "aislamiento"] as const;
type Tipo = (typeof TIPOS)[number];

export async function GET(_req: Request) {
  const g = await guardStaff("hospital.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const filas = await db
    .select({
      id: beds.id,
      nombre: beds.nombre,
      area: beds.area,
      tipo: beds.tipo,
      estado: beds.estado,
      ocupanteNombre: patients.nombre,
      ocupanteAdmissionId: admissions.id,
    })
    .from(beds)
    .leftJoin(
      bedAssignments,
      and(eq(bedAssignments.bedId, beds.id), isNull(bedAssignments.hasta)),
    )
    .leftJoin(admissions, eq(bedAssignments.admissionId, admissions.id))
    .leftJoin(patients, eq(admissions.patientId, patients.id))
    .where(eq(beds.tenantId, g.team.id))
    .orderBy(asc(beds.nombre));

  return NextResponse.json({
    camas: filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      area: f.area,
      tipo: f.tipo,
      estado: f.estado,
      ocupante: f.ocupanteNombre ?? null,
      admissionId: f.ocupanteAdmissionId ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const g = await guardStaff("hospital.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { nombre?: string; area?: string; tipo?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim() ?? "";
  if (nombre.length < 2) {
    return NextResponse.json({ error: "nombre_invalido" }, { status: 400 });
  }
  const tipo = (body.tipo ?? "cama") as Tipo;
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ error: "tipo_invalido" }, { status: 400 });
  }
  const area = body.area?.trim().slice(0, 80) || null;

  const db = getDb();
  const [duplicada] = await db
    .select({ id: beds.id })
    .from(beds)
    .where(and(eq(beds.tenantId, g.team.id), eq(beds.nombre, nombre)))
    .limit(1);
  if (duplicada) {
    return NextResponse.json({ error: "nombre_cama_repetido" }, { status: 409 });
  }

  const [row] = await db
    .insert(beds)
    .values({ tenantId: g.team.id, nombre, area, tipo })
    .returning({ id: beds.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "cama.crear",
    entidad: "beds",
    entidadId: row!.id,
    payload: { nombre, area, tipo },
  });

  return NextResponse.json({ ok: true, id: row!.id }, { status: 201 });
}
