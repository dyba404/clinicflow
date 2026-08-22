import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import {
  getDb,
  icuStays,
  patients,
  patientCoverages,
  insurers,
} from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface FilaBalance {
  hora: string;
  descripcion: string;
  volumen_ml_num: number;
}

interface BalanceHidrico {
  ingresos: FilaBalance[];
  egresos: FilaBalance[];
  balance_total: number;
}

async function coberturaDe(patientId: string): Promise<string | null> {
  const [c] = await getDb()
    .select({ nombre: insurers.nombre })
    .from(patientCoverages)
    .innerJoin(insurers, eq(patientCoverages.insurerId, insurers.id))
    .where(
      and(
        eq(patientCoverages.patientId, patientId),
        eq(patientCoverages.activo, true),
      ),
    )
    .limit(1);
  return c?.nombre ?? null;
}

function validarBalance(input: unknown): BalanceHidrico | null {
  if (!input || typeof input !== "object") return null;
  const b = input as Partial<BalanceHidrico>;
  if (!Array.isArray(b.ingresos) || !Array.isArray(b.egresos)) return null;
  const validos = (filas: unknown[]): FilaBalance[] | null => {
    const out: FilaBalance[] = [];
    for (const f of filas) {
      if (!f || typeof f !== "object") return null;
      const fila = f as Record<string, unknown>;
      const volumen = Number(fila.volumen_ml_num);
      if (
        typeof fila.hora !== "string" ||
        typeof fila.descripcion !== "string" ||
        !Number.isFinite(volumen) ||
        volumen < 0
      ) {
        return null;
      }
      out.push({
        hora: fila.hora,
        descripcion: fila.descripcion.trim(),
        volumen_ml_num: volumen,
      });
    }
    return out;
  };
  const ingresos = validos(b.ingresos);
  const egresos = validos(b.egresos);
  if (!ingresos || !egresos) return null;
  const total =
    ingresos.reduce((acc, f) => acc + f.volumen_ml_num, 0) -
    egresos.reduce((acc, f) => acc + f.volumen_ml_num, 0);
  return { ingresos, egresos, balance_total: total };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("icu.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [row] = await db
    .select({
      id: icuStays.id,
      patientId: icuStays.patientId,
      nombrePaciente: patients.nombre,
      admissionId: icuStays.admissionId,
      ingresoAt: icuStays.ingresoAt,
      egresoAt: icuStays.egresoAt,
      balanceHidrico: icuStays.balanceHidrico,
      notas: icuStays.notas,
    })
    .from(icuStays)
    .innerJoin(patients, eq(icuStays.patientId, patients.id))
    .where(and(eq(icuStays.id, id), eq(icuStays.tenantId, g.team.id)))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "estancia_no_encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    estancia: {
      ...row,
      balance: validarBalance(row.balanceHidrico),
      cobertura: await coberturaDe(row.patientId),
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("icu.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    balanceHidrico?: unknown;
    notas?: string;
    egreso?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [actual] = await db
    .select({
      id: icuStays.id,
      patientId: icuStays.patientId,
      egresoAt: icuStays.egresoAt,
      balanceHidrico: icuStays.balanceHidrico,
      notas: icuStays.notas,
    })
    .from(icuStays)
    .where(and(eq(icuStays.id, id), eq(icuStays.tenantId, g.team.id)))
    .limit(1);
  if (!actual) {
    return NextResponse.json({ error: "estancia_no_encontrada" }, { status: 404 });
  }
  if (actual.egresoAt) {
    return NextResponse.json({ error: "estancia_ya_egresada" }, { status: 409 });
  }

  const cambios: { balanceHidrico: unknown; notas?: string | null; egresoAt?: Date } = {
    balanceHidrico: actual.balanceHidrico,
  };
  let balance = validarBalance(actual.balanceHidrico);

  if (typeof body.balanceHidrico !== "undefined") {
    const nuevo = validarBalance(body.balanceHidrico);
    if (!nuevo) {
      return NextResponse.json({ error: "balance_invalido" }, { status: 400 });
    }
    balance = nuevo;
    cambios.balanceHidrico = nuevo;
  }

  if (typeof body.notas !== "undefined") {
    cambios.notas = body.notas?.trim() || null;
  }

  if (body.egreso === true) {
    if (!balance) {
      return NextResponse.json({ error: "balance_requerido_para_egreso" }, { status: 400 });
    }
    cambios.egresoAt = new Date();
  }

  const [row] = await db
    .update(icuStays)
    .set({ ...cambios, updatedAt: new Date() })
    .where(and(eq(icuStays.id, id), eq(icuStays.tenantId, g.team.id)))
    .returning({ id: icuStays.id, balanceHidrico: icuStays.balanceHidrico });

  if (typeof body.balanceHidrico !== "undefined") {
    void logAuditSesion({
      tenantId: g.team.id,
      accion: "uci.balance",
      entidad: "icu_stays",
      entidadId: id,
      payload: {
        patientId: actual.patientId,
        ingresos: balance?.ingresos.length ?? 0,
        egresos: balance?.egresos.length ?? 0,
        total: balance?.balance_total ?? null,
      },
    });
  }

  if (body.egreso === true) {
    void logAuditSesion({
      tenantId: g.team.id,
      accion: "uci.egreso",
      entidad: "icu_stays",
      entidadId: id,
      payload: { patientId: actual.patientId },
    });
  }

  return NextResponse.json({ ok: true, id: row!.id, balance });
}
