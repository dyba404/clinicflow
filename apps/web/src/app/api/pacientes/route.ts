import { NextResponse } from "next/server";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { getDb, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guardStaff("patients.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ error: "q_requerido" }, { status: 400 });
  }

  const pattern = `%${q}%`;
  const rows = await getDb()
    .select({ id: patients.id, nombre: patients.nombre, celular: patients.celular })
    .from(patients)
    .where(
      and(
        eq(patients.tenantId, g.team.id),
        or(
          ilike(patients.nombre, pattern),
          ilike(patients.celular, pattern),
          ilike(patients.documento, pattern),
        ),
      ),
    )
    .orderBy(asc(patients.nombre))
    .limit(5);

  return NextResponse.json({ pacientes: rows });
}

export async function POST(req: Request) {
  const g = await guardStaff("patients.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    nombre?: string;
    celular?: string;
    email?: string;
    documento?: string;
    fnac?: string;
    alergias?: string;
    gestacion?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim();
  if (!nombre || nombre.length < 3 || nombre.length > 80) {
    return NextResponse.json({ error: "nombre_invalido" }, { status: 400 });
  }
  const celular = body.celular?.replace(/\s+/g, "") ?? "";
  if (!/^\+?[0-9]{7,15}$/.test(celular)) {
    return NextResponse.json({ error: "celular_invalido" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "email_invalido" }, { status: 400 });
  }
  const documento = body.documento?.trim() || null;
  const fnac = body.fnac && /^\d{4}-\d{2}-\d{2}$/.test(body.fnac) ? body.fnac : null;
  const alergias = body.alergias?.trim() || null;
  const gestacion = Boolean(body.gestacion);

  const db = getDb();

  const [duplicado] = await db
    .select({ id: patients.id, nombre: patients.nombre, celular: patients.celular })
    .from(patients)
    .where(and(eq(patients.tenantId, g.team.id), eq(patients.celular, celular)))
    .limit(1);
  if (duplicado) {
    return NextResponse.json(
      { error: "duplicado", existente: duplicado },
      { status: 409 },
    );
  }

  const [row] = await db
    .insert(patients)
    .values({
      tenantId: g.team.id,
      nombre,
      celular,
      email,
      documento,
      fnac,
      alergias,
      gestacion,
      createdBy: g.user.id,
    })
    .returning({ id: patients.id, nombre: patients.nombre, celular: patients.celular });

  return NextResponse.json({ ok: true, paciente: row }, { status: 201 });
}
