import { hasPermission } from "@clinicflow/core";
import type { StaffRole } from "@clinicflow/core";
import { redirect } from "next/navigation";
import { and, desc, eq, gte, isNull, asc, count, sql } from "drizzle-orm";
import {
  getDb,
  appointments,
  payments,
  surgeries,
  beds,
  bedAssignments,
  admissions,
} from "@clinicflow/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/console/page-header";
import { getSession } from "@/lib/auth";
import { getDefaultTeam } from "@/lib/console-data";
import { fmtPEN } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DireccionPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const rol: StaffRole = session.role;

  if (!hasPermission(rol, "reports.view_all")) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Sin permiso"
          description="Tu rol no puede ver el panel de dirección."
        />
      </div>
    );
  }

  const team = await getDefaultTeam();
  if (!team) redirect("/login");

  const db = getDb();
  const lima = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" });
  const ahora = new Date();
  const hoy = lima.format(ahora);
  const dias = 30;
  const desde = lima.format(new Date(ahora.getTime() - dias * 86_400_000));

  const [camasRows, admisionesActivas, topProcedimientos, pagosRows, esperaRows] = await Promise.all([
    db
      .select({ id: beds.id, estado: beds.estado })
      .from(beds)
      .where(eq(beds.tenantId, team.id)),
    db
      .select({ id: admissions.id })
      .from(admissions)
      .where(and(eq(admissions.tenantId, team.id), eq(admissions.estado, "activa"))),
    db
      .select({
        procedimiento: surgeries.procedimiento,
        total: sql<number>`count(${surgeries.id})`.mapWith(Number),
      })
      .from(surgeries)
      .where(
        and(
          eq(surgeries.tenantId, team.id),
          gte(surgeries.scheduledAt, new Date(`${desde}T00:00:00-05:00`)),
        ),
      )
      .groupBy(surgeries.procedimiento)
      .orderBy(desc(sql`count(${surgeries.id})`))
      .limit(5),
    db
      .select({ monto: payments.monto, estado: payments.estado })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, team.id),
          gte(payments.createdAt, new Date(`${desde}T00:00:00-05:00`)),
        ),
      ),
    db
      .select({ id: appointments.id, createdAt: appointments.createdAt })
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, team.id),
          eq(appointments.estado, "en_espera"),
        ),
      )
      .orderBy(asc(appointments.createdAt)),
  ]);

  const totalCamas = camasRows.length;
  const camasOcupadas = camasRows.filter((c) => c.estado === "ocupada").length;
  const ocupacionCamas = totalCamas > 0 ? Math.round((camasOcupadas / totalCamas) * 100) : 0;

  const pagosValidos = pagosRows.filter((p) => p.estado === "valido");
  const totalCobrado = pagosValidos.reduce((acc, p) => acc + Number(p.monto), 0);
  const ticketPromedio = pagosValidos.length > 0 ? totalCobrado / pagosValidos.length : 0;

  const ahoraMs = Date.now();
  const masAntigua = esperaRows[0];
  const esperaMasAntiguaMin = masAntigua
    ? Math.max(0, Math.round((ahoraMs - new Date(masAntigua.createdAt).getTime()) / 60_000))
    : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Dirección"
        description="Panel del director médico: ocupación, procedimientos, ingreso y espera."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Ocupación de camas"
          value={`${ocupacionCamas} %`}
          sub={`${camasOcupadas} de ${totalCamas} camas`}
        />
        <Stat
          label="Pacientes internados"
          value={String(admisionesActivas.length)}
          sub="admisiones activas"
        />
        <Stat
          label="Ticket promedio"
          value={fmtPEN(ticketPromedio)}
          sub={`últimos ${dias} días`}
        />
        <Stat
          label="En sala de espera"
          value={String(esperaRows.length)}
          sub={
            esperaMasAntiguaMin > 0
              ? `la más antigua espera ${esperaMasAntiguaMin} min`
              : "sin espera acumulada"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-medium">Top procedimientos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            {topProcedimientos.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aún no hay cirugías programadas en el rango.
              </p>
            ) : (
              topProcedimientos.map((p, i) => (
                <div key={p.procedimiento} className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.procedimiento}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{p.total}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-medium">Ocupación en tiempo real</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Camas ocupadas</span>
                <span className="tabular-nums">{camasOcupadas}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Camas libres</span>
                <span className="tabular-nums">{totalCamas - camasOcupadas}</span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.max(0, Math.min(100, ocupacionCamas))}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex min-h-[110px] flex-col justify-between rounded-2xl border bg-card p-5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-3">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
        <span className="ml-2 text-xs text-muted-foreground">{sub}</span>
      </div>
    </div>
  );
}
