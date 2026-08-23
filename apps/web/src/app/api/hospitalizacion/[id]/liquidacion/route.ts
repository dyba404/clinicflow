import { NextResponse } from "next/server";
import { and, eq, isNull, ne } from "drizzle-orm";
import {
  getDb,
  admissionDeposits,
  admissions,
  invoices,
  patients,
} from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";

export const dynamic = "force-dynamic";

function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("hospital.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [admision] = await db
    .select({
      id: admissions.id,
      patientId: admissions.patientId,
      estado: admissions.estado,
      nombrePaciente: patients.nombre,
    })
    .from(admissions)
    .innerJoin(patients, eq(admissions.patientId, patients.id))
    .where(and(eq(admissions.id, id), eq(admissions.tenantId, g.team.id)))
    .limit(1);
  if (!admision) {
    return NextResponse.json({ error: "admision_no_encontrada" }, { status: 404 });
  }

  const facturas = await db
    .select({
      id: invoices.id,
      total: invoices.total,
      estado: invoices.estado,
      emitidaAt: invoices.emitidaAt,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, g.team.id),
        eq(invoices.admissionId, id),
        ne(invoices.estado, "anulada"),
      ),
    );

  const depositos = await db
    .select({
      id: admissionDeposits.id,
      monto: admissionDeposits.monto,
      metodo: admissionDeposits.metodo,
      anuladoAt: admissionDeposits.anuladoAt,
      createdAt: admissionDeposits.createdAt,
    })
    .from(admissionDeposits)
    .where(
      and(
        eq(admissionDeposits.tenantId, g.team.id),
        eq(admissionDeposits.admissionId, id),
        isNull(admissionDeposits.anuladoAt),
      ),
    );

  const facturado = redondear(
    facturas.reduce((acc, f) => acc + Number(f.total), 0),
  );
  const depositado = redondear(
    depositos.reduce((acc, d) => acc + Number(d.monto), 0),
  );
  const saldo = redondear(facturado - depositado);

  return NextResponse.json({
    admision: {
      id: admision.id,
      nombrePaciente: admision.nombrePaciente,
      estado: admision.estado,
    },
    facturado,
    depositado,
    saldo,
    facturas: facturas.map((f) => ({ ...f, totalNum: Number(f.total) })),
    depositos: depositos.map((d) => ({ ...d, montoNum: Number(d.monto) })),
  });
}
