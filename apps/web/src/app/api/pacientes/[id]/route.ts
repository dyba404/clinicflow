import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const g = await guardStaff("records.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    nombre?: string;
    celular?: string;
    email?: string | null;
    documento?: string | null;
    fnac?: string | null;
    alergias?: string | null;
    antecedentes?: string | null;
    medicacion?: string | null;
    gestacion?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const updates: {
    nombre?: string;
    celular?: string;
    email?: string | null;
    documento?: string | null;
    fnac?: string | null;
    alergias?: string | null;
    antecedentes?: string | null;
    medicacion?: string | null;
    gestacion?: boolean;
  } = {};

  if (body.nombre !== undefined) {
    const nombre = body.nombre.trim();
    if (!nombre || nombre.length < 3 || nombre.length > 80) {
      return NextResponse.json({ error: "nombre_invalido" }, { status: 400 });
    }
    updates.nombre = nombre;
  }
  if (body.celular !== undefined) {
    const celular = body.celular.replace(/\s+/g, "");
    if (!/^\+?[0-9]{7,15}$/.test(celular)) {
      return NextResponse.json({ error: "celular_invalido" }, { status: 400 });
    }
    updates.celular = celular;
  }
  if (body.email !== undefined) {
    const email = body.email?.trim().toLowerCase() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "email_invalido" }, { status: 400 });
    }
    updates.email = email;
  }
  if (body.documento !== undefined) {
    updates.documento = body.documento?.trim() || null;
  }
  if (body.fnac !== undefined) {
    updates.fnac =
      body.fnac && /^\d{4}-\d{2}-\d{2}$/.test(body.fnac) ? body.fnac : null;
  }
  if (body.alergias !== undefined) {
    updates.alergias = body.alergias?.trim() || null;
  }
  if (body.antecedentes !== undefined) {
    updates.antecedentes = body.antecedentes?.trim() || null;
  }
  if (body.medicacion !== undefined) {
    updates.medicacion = body.medicacion?.trim() || null;
  }
  if (body.gestacion !== undefined) {
    if (typeof body.gestacion !== "boolean") {
      return NextResponse.json({ error: "gestacion_invalida" }, { status: 400 });
    }
    updates.gestacion = body.gestacion;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "sin_cambios" }, { status: 400 });
  }

  const db = getDb();
  const [existente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!existente) {
    return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
  }

  if (updates.celular) {
    const [duplicado] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(
          eq(patients.tenantId, g.team.id),
          eq(patients.celular, updates.celular),
        ),
      )
      .limit(1);
    if (duplicado && duplicado.id !== id) {
      return NextResponse.json({ error: "duplicado" }, { status: 409 });
    }
  }

  const [row] = await db
    .update(patients)
    .set(updates)
    .where(eq(patients.id, id))
    .returning();

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "paciente.editar",
    entidad: "patients",
    entidadId: id,
    payload: { cambios: Object.keys(updates) },
  });

  return NextResponse.json({ ok: true, paciente: row });
}
