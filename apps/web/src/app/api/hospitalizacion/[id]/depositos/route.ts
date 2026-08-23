import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  getDb,
  admissionDeposits,
  admissions,
  payments,
  users,
} from "@clinicflow/db";
import type { PaymentMethod } from "@clinicflow/core";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";
import { sucursalActiva } from "@/lib/branch";

export const dynamic = "force-dynamic";

const METODOS: PaymentMethod[] = [
  "yape",
  "plin",
  "efectivo",
  "tarjeta_pos",
  "tarjeta_online",
  "otro",
];

async function obtenerAdmision(id: string, tenantId: string) {
  const [row] = await getDb()
    .select({ id: admissions.id, patientId: admissions.patientId, estado: admissions.estado })
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
      id: admissionDeposits.id,
      monto: admissionDeposits.monto,
      metodo: admissionDeposits.metodo,
      referencia: admissionDeposits.referencia,
      nota: admissionDeposits.nota,
      anuladoAt: admissionDeposits.anuladoAt,
      motivoAnulacion: admissionDeposits.motivoAnulacion,
      nombreRegistro: users.name,
      createdAt: admissionDeposits.createdAt,
    })
    .from(admissionDeposits)
    .leftJoin(users, eq(admissionDeposits.registradoPor, users.id))
    .where(and(eq(admissionDeposits.tenantId, g.team.id), eq(admissionDeposits.admissionId, id)))
    .orderBy(desc(admissionDeposits.createdAt));

  return NextResponse.json({
    depositos: rows.map((r) => ({ ...r, montoNum: Number(r.monto) })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("payments.register");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { monto?: unknown; metodo?: string; referencia?: string; nota?: string };
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

  const monto = Number(body.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: "monto_invalido" }, { status: 400 });
  }
  const metodo = body.metodo as PaymentMethod;
  if (!METODOS.includes(metodo)) {
    return NextResponse.json({ error: "metodo_desconocido" }, { status: 400 });
  }

  const db = getDb();
  const branchId = await sucursalActiva(g.team.id);

  const [pago] = await db
    .insert(payments)
    .values({
      tenantId: g.team.id,
      branchId,
      patientId: admision.patientId,
      monto: monto.toFixed(2),
      metodo,
      referencia: body.referencia?.trim() || null,
      registradoPor: g.user.id,
    })
    .returning({ id: payments.id });

  const [row] = await db
    .insert(admissionDeposits)
    .values({
      tenantId: g.team.id,
      admissionId: id,
      paymentId: pago!.id,
      monto: monto.toFixed(2),
      metodo,
      referencia: body.referencia?.trim() || null,
      nota: body.nota?.trim() || null,
      registradoPor: g.user.id,
    })
    .returning({ id: admissionDeposits.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "hospitalizacion.deposito",
    entidad: "admission_deposits",
    entidadId: row!.id,
    payload: { admissionId: id, monto, metodo },
  });

  return NextResponse.json({ ok: true, id: row!.id }, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("payments.register");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { depositoId?: string; motivo?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (!body.depositoId) {
    return NextResponse.json({ error: "id_requerido" }, { status: 400 });
  }

  const db = getDb();
  const [deposito] = await db
    .select({
      id: admissionDeposits.id,
      paymentId: admissionDeposits.paymentId,
      anuladoAt: admissionDeposits.anuladoAt,
    })
    .from(admissionDeposits)
    .where(
      and(
        eq(admissionDeposits.id, body.depositoId),
        eq(admissionDeposits.admissionId, id),
        eq(admissionDeposits.tenantId, g.team.id),
      ),
    )
    .limit(1);
  if (!deposito) {
    return NextResponse.json({ error: "deposito_no_encontrado" }, { status: 404 });
  }
  if (deposito.anuladoAt) {
    return NextResponse.json({ error: "deposito_ya_anulado" }, { status: 409 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(admissionDeposits)
      .set({
        anuladoAt: new Date(),
        anuladoPor: g.user.id,
        motivoAnulacion: body.motivo?.trim() || null,
      })
      .where(eq(admissionDeposits.id, deposito.id));
    if (deposito.paymentId) {
      await tx
        .update(payments)
        .set({
          estado: "anulado",
          anuladoPor: g.user.id,
          anuladoAt: new Date(),
          motivoAnulacion: body.motivo?.trim() || "deposito_anulado",
        })
        .where(
          and(eq(payments.id, deposito.paymentId), isNull(payments.anuladoAt)),
        );
    }
  });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "hospitalizacion.deposito_anular",
    entidad: "admission_deposits",
    entidadId: deposito.id,
    payload: { admissionId: id },
  });

  return NextResponse.json({ ok: true });
}
