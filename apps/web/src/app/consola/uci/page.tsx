import { redirect } from "next/navigation";
import { BedDouble, Lock } from "lucide-react";
import { hasPermission } from "@clinicflow/core";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, icuStays, patients, patientCoverages, insurers } from "@clinicflow/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { getSession } from "@/lib/auth";
import { UciPanel, type BalanceHidrico, type EstanciaUci } from "./uci-panel";

export const dynamic = "force-dynamic";

export default async function UciPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "icu.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="UCI"
          description="Estancias en unidad de cuidados intensivos con control de balance hídrico."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo el dueño puede gestionar UCI por ahora."
          />
        </Card>
      </div>
    );
  }

  const db = getDb();
  const rows = await db
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
    .where(and(eq(icuStays.tenantId, session.teamId), isNull(icuStays.egresoAt)))
    .orderBy(desc(icuStays.ingresoAt));

  const coberturaPorPaciente = new Map<string, string>();
  if (rows.length > 0) {
    const coberturas = await db
      .select({
        patientId: patientCoverages.patientId,
        nombre: insurers.nombre,
        createdAt: patientCoverages.createdAt,
      })
      .from(patientCoverages)
      .innerJoin(insurers, eq(patientCoverages.insurerId, insurers.id))
      .where(
        and(
          inArray(patientCoverages.patientId, rows.map((r) => r.patientId)),
          eq(patientCoverages.activo, true),
        ),
      )
      .orderBy(desc(patientCoverages.createdAt));
    for (const c of coberturas) {
      if (!coberturaPorPaciente.has(c.patientId)) coberturaPorPaciente.set(c.patientId, c.nombre);
    }
  }

  const estancias: EstanciaUci[] = rows.map((r) => ({
    id: r.id,
    patientId: r.patientId,
    nombrePaciente: r.nombrePaciente,
    admissionId: r.admissionId,
    ingresoAt: r.ingresoAt.toISOString(),
    egresoAt: r.egresoAt ? r.egresoAt.toISOString() : null,
    balance: r.balanceHidrico as BalanceHidrico | null,
    notas: r.notas,
    cobertura: coberturaPorPaciente.get(r.patientId) ?? null,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="UCI"
        description="Estancias activas, balance hídrico y egresos de la unidad de cuidados intensivos."
      />
      {estancias.length === 0 ? (
        <Card>
          <EmptyState
            icon={BedDouble}
            title="Sin pacientes en UCI"
            description="Cuando registres un ingreso UCI aparecerá aquí para controlar su balance hídrico."
          />
        </Card>
      ) : null}
      <UciPanel estancias={estancias} />
    </div>
  );
}
