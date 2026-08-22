import { hasPermission } from "@clinicflow/core";
import type { StaffRole } from "@clinicflow/core";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { IngresosChart } from "@/app/consola/dashboard/ingresos-chart";
import { PeriodosPills } from "./dashboard-periodos";
import { getSession } from "@/lib/auth";
import { gatePlan } from "@/lib/plans";
import { PlanGate } from "@/components/console/plan-gate";
import { margenesPorServicio } from "@/lib/inventario";
import {
  getDefaultTeam,
  ingresosDiarios,
  ingresosPorMetodo,
  statsRango,
  topServicios,
  teamOverview,
} from "@/lib/console-data";
import { fmtPEN } from "@/lib/format";

export const dynamic = "force-dynamic";


const DIAS_OPCIONES = [7, 14, 30];

const METODO_LABEL: Record<string, string> = {
  yape: "Yape",
  plin: "Plin",
  efectivo: "Efectivo",
  tarjeta_pos: "Tarjeta POS",
  tarjeta_online: "Tarjeta online",
  otro: "Otro",
};

export default async function IngresosPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const sp = await searchParams;
  const dias = DIAS_OPCIONES.includes(Number(sp.dias)) ? Number(sp.dias) : 14;

  const session = await getSession();
  if (!session) redirect("/login");
  const rol: StaffRole = session.role;

  if (!hasPermission(rol, "reports.view_all")) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Sin permiso"
          description="Tu rol no puede ver el dashboard de ingresos."
        />
      </div>
    );
  }

  const team = await getDefaultTeam();
  if (!team) redirect("/login");

  const planCheck = await gatePlan(team.id, "dashboard");
  if (!planCheck.ok) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Ingresos"
          description={`Resumen de los últimos ${dias} días con números tabulares.`}
        />
        <PlanGate feature="dashboard" requerido={planCheck.requerido} />
      </div>
    );
  }

  const lima = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" });
  const ahora = new Date();
  const fechaHasta = lima.format(ahora);
  const fechaDesde = lima.format(new Date(ahora.getTime() - dias * 86_400_000));

  const [serie, top, overview, porMetodo, stats, margenes] = await Promise.all([
    ingresosDiarios(team.id, dias),
    topServicios(team.id, 5),
    teamOverview(team.id),
    ingresosPorMetodo(team.id, fechaDesde),
    statsRango(team.id, fechaDesde, fechaHasta),
    margenesPorServicio(team.id).catch(() => []),
  ]);

  const totalRango = serie.reduce((acc, d) => acc + d.total, 0);
  const promedio = serie.length ? totalRango / serie.length : 0;
  const mejor = serie.length
    ? serie.reduce((a, b) => (b.total > a.total ? b : a))
    : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Ingresos"
        description={`Resumen de los últimos ${dias} días con números tabulares.`}
        action={<PeriodosPills dias={dias} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Hoy" value={fmtPEN(overview.ingresosHoy)} sub={`${overview.pagosHoy.length} pagos`} />
        <Stat label={`Total ${dias} días`} value={fmtPEN(totalRango)} sub="cobrado por caja" />
        <Stat label="Promedio diario" value={fmtPEN(promedio)} sub={`últimos ${dias} días`} />
        <Stat
          label="Mejor día"
          value={mejor ? fmtPEN(mejor.total) : "—"}
          sub={mejor ? `fue ${mejor.label}` : "sin datos"}
        />
        <Stat
          label="No-shows"
          value={String(stats.noShows)}
          sub={`de ${stats.total} citas en el rango`}
        />
        <Stat
          label="Ocupación %"
          value={`${stats.ocupacion} %`}
          sub={`${stats.atendidas} atendidas`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos por día</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <IngresosChart data={serie} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="p-5 pb-4">
              <CardTitle className="text-sm font-medium">Ingresos por método</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              {porMetodo.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Sin pagos en el rango.
                </p>
              ) : (
                porMetodo.map((m) => (
                  <div key={m.metodo} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {METODO_LABEL[m.metodo] ?? m.metodo}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {m.cantidad} {m.cantidad === 1 ? "pago" : "pagos"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {fmtPEN(m.total)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-5 pb-4">
              <CardTitle className="text-sm font-medium">Top servicios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              {top.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aún no hay citas atendidas.
                </p>
              ) : (
                top.map((s, i) => (
                  <div key={s.servicio} className="flex items-center gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.servicio}</p>
                      <p className="text-xs text-muted-foreground">
                        {Number(s.citas)} citas
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {fmtPEN(Number(s.total))}
                    </span>
                  </div>
                ))
              )}
              <div className="border-t pt-3">
                <Badge variant="teal">Facturado en citas atendidas</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-5 pb-4">
              <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
                Margen por servicio
                <Link
                  href="/consola/inventario"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ver inventario
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              {margenes.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Crea recetas de materiales en inventario para calcular márgenes.
                </p>
              ) : (
                margenes
                  .sort((a, b) => a.pct - b.pct)
                  .slice(0, 6)
                  .map((m) => (
                    <div key={m.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <p className="min-w-0 truncate font-medium">{m.nombre}</p>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {fmtPEN(m.margen)} · {m.pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={
                            m.pct >= 60
                              ? "h-full rounded-full bg-emerald-500"
                              : m.pct >= 30
                                ? "h-full rounded-full bg-amber-500"
                                : "h-full rounded-full bg-red-500"
                          }
                          style={{ width: `${Math.max(0, Math.min(100, m.pct))}%` }}
                        />
                      </div>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </div>
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
