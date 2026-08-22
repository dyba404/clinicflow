import { NextResponse } from "next/server";
import { asc, count, eq } from "drizzle-orm";
import { getDb, insurers, patientCoverages } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardStaff("patients.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const rows = await db
    .select({
      id: insurers.id,
      nombre: insurers.nombre,
      ruc: insurers.ruc,
      telefono: insurers.telefono,
      activo: insurers.activo,
      createdAt: insurers.createdAt,
    })
    .from(insurers)
    .where(eq(insurers.tenantId, g.team.id))
    .orderBy(asc(insurers.nombre));

  const conteos = await db
    .select({ insurerId: patientCoverages.insurerId, total: count() })
    .from(patientCoverages)
    .where(eq(patientCoverages.activo, true))
    .groupBy(patientCoverages.insurerId);
  const porAseguradora = new Map(conteos.map((c) => [c.insurerId, c.total]));

  return NextResponse.json({
    aseguradoras: rows.map((a) => ({ ...a, afiliados: porAseguradora.get(a.id) ?? 0 })),
  });
}

export async function POST(req: Request) {
  const g = await guardStaff("insurers.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { nombre?: string; ruc?: string; telefono?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim() ?? "";
  if (!nombre || nombre.length > 80) {
    return NextResponse.json({ error: "nombre_invalido" }, { status: 400 });
  }

  let ruc: string | null = null;
  if (body.ruc?.trim()) {
    ruc = body.ruc.trim();
    if (!/^\d{11}$/.test(ruc)) {
      return NextResponse.json({ error: "ruc_invalido" }, { status: 400 });
    }
  }

  const telefono = body.telefono?.trim() ?? "";
  if (telefono.length > 30) {
    return NextResponse.json({ error: "telefono_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .insert(insurers)
    .values({
      tenantId: g.team.id,
      nombre,
      ruc,
      telefono: telefono || null,
    })
    .returning({ id: insurers.id, nombre: insurers.nombre, ruc: insurers.ruc, telefono: insurers.telefono, activo: insurers.activo });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "aseguradora.crear",
    entidad: "insurers",
    entidadId: row!.id,
    payload: { nombre, ruc },
  });

  return NextResponse.json({ ok: true, id: row!.id, aseguradora: row }, { status: 201 });
}
