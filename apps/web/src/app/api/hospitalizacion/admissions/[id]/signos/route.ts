import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, vitalSigns, admissions, users } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const TURNOS = ["manana", "tarde", "noche"] as const;
type Turno = (typeof TURNOS)[number];

type SignoKey = "paSistolica" | "paDiastolica" | "temperatura" | "fc" | "fr" | "spo2";

const RANGOS: Record<SignoKey, readonly [number, number]> = {
  paSistolica: [50, 260],
  paDiastolica: [30, 160],
  temperatura: [30, 43],
  fc: [20, 220],
  fr: [5, 60],
  spo2: [50, 100],
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("hospital.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [admision] = await db
    .select({ id: admissions.id })
    .from(admissions)
    .where(and(eq(admissions.id, id), eq(admissions.tenantId, g.team.id)))
    .limit(1);
  if (!admision) {
    return NextResponse.json({ error: "admision_no_encontrada" }, { status: 404 });
  }

  const signos = await db
    .select({
      id: vitalSigns.id,
      admissionId: vitalSigns.admissionId,
      turno: vitalSigns.turno,
      paSistolica: vitalSigns.paSistolica,
      paDiastolica: vitalSigns.paDiastolica,
      temperatura: vitalSigns.temperatura,
      fc: vitalSigns.fc,
      fr: vitalSigns.fr,
      spo2: vitalSigns.spo2,
      nota: vitalSigns.nota,
      nombreRegistrado: users.name,
      createdAt: vitalSigns.createdAt,
    })
    .from(vitalSigns)
    .leftJoin(users, eq(vitalSigns.registradoPor, users.id))
    .where(and(eq(vitalSigns.tenantId, g.team.id), eq(vitalSigns.admissionId, id)))
    .orderBy(desc(vitalSigns.createdAt));

  return NextResponse.json({ signos });
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
    paSistolica?: unknown;
    paDiastolica?: unknown;
    temperatura?: unknown;
    fc?: unknown;
    fr?: unknown;
    spo2?: unknown;
    nota?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [admision] = await db
    .select({ id: admissions.id, estado: admissions.estado })
    .from(admissions)
    .where(and(eq(admissions.id, id), eq(admissions.tenantId, g.team.id)))
    .limit(1);
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

  const valores: Partial<Record<SignoKey, number>> = {};
  const entradas = [
    ["paSistolica", body.paSistolica, true],
    ["paDiastolica", body.paDiastolica, true],
    ["temperatura", body.temperatura, false],
    ["fc", body.fc, true],
    ["fr", body.fr, true],
    ["spo2", body.spo2, true],
  ] as Array<[SignoKey, unknown, boolean]>;

  for (const [clave, raw, esEntero] of entradas) {
    if (raw === undefined || raw === null || raw === "") continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    const [min, max] = RANGOS[clave];
    if (!Number.isFinite(n) || (esEntero && !Number.isInteger(n)) || n < min || n > max) {
      return NextResponse.json({ error: "rango_invalido", campo: clave }, { status: 400 });
    }
    valores[clave] = n;
  }

  if (Object.keys(valores).length === 0) {
    return NextResponse.json({ error: "signos_requeridos" }, { status: 400 });
  }

  if (
    valores.paSistolica !== undefined &&
    valores.paDiastolica !== undefined &&
    valores.paSistolica <= valores.paDiastolica
  ) {
    return NextResponse.json({ error: "pa_incoherente" }, { status: 400 });
  }

  const [row] = await db
    .insert(vitalSigns)
    .values({
      tenantId: g.team.id,
      admissionId: id,
      turno,
      paSistolica: valores.paSistolica ?? null,
      paDiastolica: valores.paDiastolica ?? null,
      temperatura: valores.temperatura === undefined ? null : valores.temperatura.toFixed(1),
      fc: valores.fc ?? null,
      fr: valores.fr ?? null,
      spo2: valores.spo2 ?? null,
      nota: body.nota?.trim() || null,
      registradoPor: g.user.id,
    })
    .returning({ id: vitalSigns.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "signo.crear",
    entidad: "vitalSigns",
    entidadId: row!.id,
    payload: { turno },
  });

  return NextResponse.json({ ok: true, id: row!.id }, { status: 201 });
}
