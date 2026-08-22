import { redirect } from "next/navigation";
import { hasPermission } from "@clinicflow/core";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { getDb, memberships, users, commissionSettings, commissionEntries } from "@clinicflow/db";
import { and, eq, sql } from "drizzle-orm";
import { getDefaultTeam } from "@/lib/console-data";
import { getSession } from "@/lib/auth";
import { gatePlan } from "@/lib/plans";
import { PlanGate } from "@/components/console/plan-gate";
import { ComisionesClient } from "@/app/consola/comisiones/comisiones-client";

export const dynamic = "force-dynamic";

function periodoActual(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date()).slice(0, 7);
}

export default async function ComisionesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "commissions.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Comisiones"
          description="Porcentaje por doctor y acumulado mensual según pagos registrados."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo el rol Dueña puede gestionar las comisiones por doctor."
          />
        </Card>
      </div>
    );
  }

  const planCheck = await gatePlan(team.id, "comisiones");
  if (!planCheck.ok) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Comisiones"
          description="Porcentaje por doctor y acumulado mensual según pagos registrados."
        />
        <PlanGate feature="comisiones" requerido={planCheck.requerido} />
      </div>
    );
  }

  const sp = await searchParams;
  const periodo =
    sp.periodo && /^\d{4}-\d{2}$/.test(sp.periodo) ? sp.periodo : periodoActual(team.timezone);

  const doctores = await getDb()
    .select({
      membershipId: memberships.id,
      nombre: users.name,
      porcentaje: commissionSettings.porcentaje,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .leftJoin(commissionSettings, eq(commissionSettings.membershipId, memberships.id))
    .where(
      and(
        eq(memberships.teamId, team.id),
        eq(memberships.role, "doctor"),
        eq(memberships.active, true),
      ),
    );

  const resumen = await getDb()
    .select({
      doctorMembershipId: commissionEntries.doctorMembershipId,
      nombre: users.name,
      total: sql<string>`sum(${commissionEntries.monto})`,
      pagos: sql<number>`count(${commissionEntries.id})`.mapWith(Number),
    })
    .from(commissionEntries)
    .leftJoin(memberships, eq(memberships.id, commissionEntries.doctorMembershipId))
    .leftJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(commissionEntries.tenantId, team.id), eq(commissionEntries.periodo, periodo)))
    .groupBy(commissionEntries.doctorMembershipId, users.name);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Comisiones"
        description="Porcentaje por doctor y acumulado mensual según pagos registrados."
      />
      <ComisionesClient
        doctores={doctores.map((d) => ({
          membershipId: d.membershipId,
          nombre: d.nombre,
          porcentaje: d.porcentaje !== null ? Number(d.porcentaje) : 0,
        }))}
        resumen={resumen.map((r) => ({
          doctorMembershipId: r.doctorMembershipId,
          nombre: r.nombre ?? "—",
          total: Number(r.total ?? 0),
          pagos: r.pagos,
        }))}
        periodo={periodo}
      />
    </div>
  );
}
