import { Building2, CalendarCheck, MapPin, Phone, Wallet } from "lucide-react";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { hasPermission } from "@clinicflow/core";
import { getDb, appointments, branches, payments } from "@clinicflow/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import {
  EditarSucursalButton,
  NuevaSucursalButton,
} from "@/app/consola/sucursales/sucursal-dialogs";
import { getSession } from "@/lib/auth";
import { getDefaultTeam } from "@/lib/console-data";
import { sucursalActiva } from "@/lib/branch";
import { SucursalSelector } from "@/app/consola/sucursales/selector";
import { fmtPEN } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SucursalesPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "branches.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Sucursales"
          description="Gestión de locales: agendas y caja separadas por sucursal."
        />
        <Card>
          <EmptyState
            icon={Building2}
            title="Sin permiso"
            description="Solo el rol Dueño/a puede gestionar sucursales."
          />
        </Card>
      </div>
    );
  }

  const db = getDb();
  const todas = await db
    .select()
    .from(branches)
    .where(eq(branches.tenantId, team.id))
    .orderBy(asc(branches.createdAt));

  const sucursalId = await sucursalActiva(team.id);

  if (todas.length === 0) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Sucursales"
          description="Gestión de locales: agendas y caja separadas por sucursal."
          action={<NuevaSucursalButton />}
        />
        <Card>
          <EmptyState
            icon={Building2}
            title="Aún no hay sucursales"
            description="Crea tu primera sucursal para separar agendas y caja por local."
            action={<NuevaSucursalButton />}
          />
        </Card>
      </div>
    );
  }

  const ids = todas.map((b) => b.id);
  const citasRows = await db
    .select({
      branchId: appointments.branchId,
      total: sql<number>`count(${appointments.id})`.mapWith(Number),
    })
    .from(appointments)
    .where(and(eq(appointments.tenantId, team.id), inArray(appointments.branchId, ids)))
    .groupBy(appointments.branchId);
  const citasMap = new Map(citasRows.map((r) => [r.branchId, r.total]));

  const pagosRows = await db
    .select({
      branchId: payments.branchId,
      total: sql<number>`coalesce(sum(${payments.monto}), 0)`.mapWith(Number),
    })
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, team.id),
        eq(payments.estado, "valido"),
        inArray(payments.branchId, ids),
      ),
    )
    .groupBy(payments.branchId);
  const pagosMap = new Map(pagosRows.map((r) => [r.branchId, r.total]));

  const statsRows = await db
    .select({
      branchId: appointments.branchId,
      atendidas:
        sql<number>`count(${appointments.id}) filter (where ${appointments.estado} = 'atendida')`.mapWith(Number),
      noShows:
        sql<number>`count(${appointments.id}) filter (where ${appointments.estado} = 'no_show')`.mapWith(Number),
    })
    .from(appointments)
    .where(and(eq(appointments.tenantId, team.id), inArray(appointments.branchId, ids)))
    .groupBy(appointments.branchId);
  const benchCitas = new Map(statsRows.map((r) => [r.branchId, r]));
  const benchPagos = pagosMap;

  const maxIngresos = Math.max(0, ...ids.map((i) => benchPagos.get(i) ?? 0));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Sucursales"
        description={`${todas.filter((b) => b.activo).length} de ${todas.length} sucursales activas.`}
        action={<NuevaSucursalButton />}
      />

      <div className="flex justify-end">
        <SucursalSelector
          sucursalId={sucursalId}
          sucursales={todas
            .filter((b) => b.activo)
            .map((b) => ({ id: b.id, nombre: b.nombre, slug: b.slug }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {todas.map((b) => (
          <Card key={b.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Building2 className="size-5" />
                </span>
                <div className="min-w-0">
                  <CardTitle className="truncate">{b.nombre}</CardTitle>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">/{b.slug}</p>
                </div>
              </div>
              <EditarSucursalButton
                sucursal={{
                  id: b.id,
                  nombre: b.nombre,
                  slug: b.slug,
                  direccion: b.direccion,
                  telefono: b.telefono,
                  activo: b.activo,
                }}
              />
            </CardHeader>
            <CardContent className="space-y-2">
              {b.activo ? (
                <Badge variant="green">Activa</Badge>
              ) : (
                <Badge variant="gray">Inactiva</Badge>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {b.direccion ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" /> {b.direccion}
                  </span>
                ) : null}
                {b.telefono ? (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3" /> {b.telefono}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <CalendarCheck className="size-3" /> {citasMap.get(b.id) ?? 0} citas
                </span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Wallet className="size-3" /> {fmtPEN(pagosMap.get(b.id) ?? 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {todas.length >= 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>Benchmark entre sucursales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Sucursal</th>
                    <th className="pb-2 pr-4 font-medium">Ingresos</th>
                    <th className="pb-2 pr-4 font-medium">Citas atendidas</th>
                    <th className="pb-2 pr-4 font-medium">No-shows</th>
                    <th className="pb-2 font-medium">Ocupación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {todas
                    .filter((b) => b.activo)
                    .map((b) => {
                      const ingresos = benchPagos.get(b.id) ?? 0;
                      const atendidas = benchCitas.get(b.id)?.atendidas ?? 0;
                      const noShows = benchCitas.get(b.id)?.noShows ?? 0;
                      const ocupables = atendidas + noShows;
                      const ocupacion =
                        ocupables > 0 ? Math.round((atendidas / ocupables) * 100) : 0;
                      const ancho =
                        maxIngresos > 0 ? Math.max(4, Math.round((ingresos / maxIngresos) * 100)) : 0;
                      return (
                        <tr key={b.id}>
                          <td className="max-w-[140px] truncate py-3 pr-4 font-medium">{b.nombre}</td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="w-24 shrink-0 tabular-nums">{fmtPEN(ingresos)}</span>
                              <span className="h-2 min-w-8 flex-1 overflow-hidden rounded-full bg-muted">
                                <span
                                  className="block h-2 rounded-full bg-primary"
                                  style={{ width: `${ancho}%` }}
                                />
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 tabular-nums">{atendidas}</td>
                          <td className="py-3 pr-4 tabular-nums">{noShows}</td>
                          <td className="py-3 tabular-nums">{ocupacion}%</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              La ocupación compara citas atendidas frente a atendidas más no-shows con datos históricos.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
