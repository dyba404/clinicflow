import { Lock, Receipt } from "lucide-react";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { hasPermission } from "@clinicflow/core";
import { getDb, insurers } from "@clinicflow/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { RegistrarPago } from "@/app/consola/caja/registrar-pago";
import { CierreDialog } from "@/app/consola/caja/components/cierre-dialog";
import { AnularPago } from "@/app/consola/caja/components/anular-pago";
import { SplitAseguradora } from "@/app/consola/caja/components/split-aseguradora";
import { ReabrirCierre } from "@/app/consola/caja/components/reabrir-cierre";
import { getDefaultTeam, cajaHoy, pacientesBasicos, cierreDelDia, cierresDeCaja } from "@/lib/console-data";
import { getSession } from "@/lib/auth";
import { gatePlan } from "@/lib/plans";
import { PlanGate } from "@/components/console/plan-gate";
import { fmtPEN, fmtHora, fmtFechaRelativa } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const METODO_BADGE: Record<string, "teal" | "amber" | "green" | "blue" | "violet" | "gray"> = {
  yape: "violet",
  plin: "teal",
  efectivo: "green",
  tarjeta_pos: "blue",
  tarjeta_online: "amber",
  otro: "gray",
};

const METODO_LABEL: Record<string, string> = {
  yape: "Yape",
  plin: "Plin",
  efectivo: "Efectivo",
  tarjeta_pos: "Tarjeta POS",
  tarjeta_online: "Tarjeta online",
  otro: "Otro",
};

function hoyLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

function fmtFecha(fecha: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${fecha}T12:00:00`));
}

export default async function CajaPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "payments.register")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Caja" description="Solo recepción y dueño pueden registrar." />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo los roles Dueño y Recepción pueden ver la caja del día."
          />
        </Card>
      </div>
    );
  }

  const planCheck = await gatePlan(team.id, "caja");
  if (!planCheck.ok) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Caja" description="Solo recepción y dueño pueden registrar." />
        <PlanGate feature="caja" requerido={planCheck.requerido} />
      </div>
    );
  }

  const hoy = hoyLima();
  const [todos, pacientes, cierreHoy, cierres, aseguradoras] = await Promise.all([
    cajaHoy(team.id),
    pacientesBasicos(team.id),
    cierreDelDia(team.id, hoy),
    cierresDeCaja(team.id),
    getDb()
      .select({ id: insurers.id, nombre: insurers.nombre })
      .from(insurers)
      .where(eq(insurers.tenantId, team.id))
      .orderBy(asc(insurers.nombre)),
  ]);
  const role = session.role;
  const cierreHoyCerrado = cierreHoy !== null && cierreHoy.estado === "cerrado";

  const pagosHoy = todos.filter((p) => {
    if (p.estado === "anulado" || p.estado === "por_conciliar") return false;
    const d = p.createdAt
      ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date(p.createdAt))
      : null;
    return d === hoy;
  });
  const totalHoy = pagosHoy.reduce((acc, p) => acc + Number(p.monto), 0);

  const porMetodo = new Map<string, { total: number; n: number }>();
  for (const p of pagosHoy) {
    const cur = porMetodo.get(p.metodo) ?? { total: 0, n: 0 };
    porMetodo.set(p.metodo, { total: cur.total + Number(p.monto), n: cur.n + 1 });
  }
  const metodos = Array.from(porMetodo.entries())
    .map(([metodo, v]) => ({ metodo, ...v }))
    .sort((a, b) => b.total - a.total);
  const sinMetodo = Object.keys(METODO_LABEL).filter((m) => !porMetodo.has(m));

  const puedeCerrar = hasPermission(role, "payments.register");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Caja"
        description={`${pagosHoy.length} pagos registrados hoy. Solo recepción y dueño pueden registrar.`}
        action={
          cierreHoyCerrado ? (
            <div className="flex items-center gap-2">
              <Badge variant="green">Caja cerrada</Badge>
              <Button size="sm" disabled>
                <Lock className="size-4" />
                Cerrar caja
              </Button>
            </div>
          ) : puedeCerrar ? (
            <CierreDialog totalSistema={totalHoy} />
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex min-h-[100px] flex-col justify-between rounded-2xl border bg-card p-5">
          <span className="text-xs text-muted-foreground">Total del día</span>
          <div className="mt-2">
            <span className="text-2xl font-semibold tabular-nums tracking-tight">
              {fmtPEN(totalHoy)}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              {pagosHoy.length} pagos
            </span>
          </div>
        </div>
        {metodos.slice(0, 3).map((m) => (
          <div
            key={m.metodo}
            className="flex min-h-[100px] flex-col justify-between rounded-2xl border bg-card p-5"
          >
            <span className="flex items-center">
              <Badge variant={METODO_BADGE[m.metodo] ?? "gray"}>
                {METODO_LABEL[m.metodo] ?? m.metodo}
              </Badge>
            </span>
            <div className="mt-2">
              <span className="text-2xl font-semibold tabular-nums tracking-tight">
                {fmtPEN(m.total)}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                {m.n} {m.n === 1 ? "pago" : "pagos"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="p-5 pb-4">
              <CardTitle className="text-sm font-medium">Movimientos</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Sin pagos todavía. Registra el primero desde el panel derecho.
                    </TableCell>
                  </TableRow>
                ) : (
                  todos.map((p) => {
                    const anulado = p.estado === "anulado";
                    return (
                      <TableRow key={p.id} className={anulado ? "opacity-60" : undefined}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {p.createdAt ? `${fmtDiaRelativo(p.createdAt)} · ${fmtHora(p.createdAt)}` : "—"}
                        </TableCell>
                        <TableCell>
                          {p.patientNombre ? (
                            <span className="flex items-center gap-2">
                              <Avatar name={p.patientNombre} className="size-6 text-[10px]" />
                              <span className="text-sm font-medium">{p.patientNombre}</span>
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Sin paciente</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={METODO_BADGE[p.metodo] ?? "gray"}>
                            {METODO_LABEL[p.metodo] ?? p.metodo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.referencia ?? "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right text-sm font-semibold tabular-nums ${
                            anulado ? "line-through" : ""
                          }`}
                        >
                          {fmtPEN(Number(p.monto))}
                        </TableCell>
                        <TableCell className="text-right">
                          {anulado ? (
                            <Badge variant="gray">Anulado</Badge>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <SplitAseguradora
                                pagoId={p.id}
                                monto={Number(p.monto)}
                                paciente={p.patientNombre}
                                aseguradoras={aseguradoras}
                              />
                              <AnularPago
                                pagoId={p.id}
                                monto={Number(p.monto)}
                                paciente={p.patientNombre}
                              />
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>

          <Card>
            <CardHeader className="p-5 pb-4">
              <CardTitle className="text-sm font-medium">Historial de cierres</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Cierre sistema</TableHead>
                  <TableHead className="text-right">Cierre real</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead>Cerró</TableHead>
                  <TableHead className="text-right">Hora</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cierres.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Sin cierres registrados todavía.
                    </TableCell>
                  </TableRow>
                ) : (
                  cierres.map((c) => {
                    const diff = Number(c.diferencia);
                    const cerrada = c.estado === "cerrado";
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="whitespace-nowrap text-sm font-medium">
                          {fmtFecha(c.fecha)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {fmtPEN(Number(c.cierreSistema))}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {fmtPEN(Number(c.cierreReal))}
                        </TableCell>
                        <TableCell
                          className={`text-right text-sm font-semibold tabular-nums ${
                            Math.abs(diff) < 0.005 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {fmtPEN(diff)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.cerradoPorNombre ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {c.createdAt ? fmtHora(c.createdAt) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {cerrada && role === "owner" ? (
                            <ReabrirCierre cierreId={c.id} fecha={fmtFecha(c.fecha)} />
                          ) : cerrada ? (
                            <Badge variant="green">Cerrada</Badge>
                          ) : (
                            <Badge variant="amber">Reabierta</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="p-5 pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Receipt className="size-4 text-primary" />
                Registrar pago
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <RegistrarPago pacientes={pacientes} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-5 pb-4">
              <CardTitle className="text-sm font-medium">Resumen por método</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-5 pt-0">
              {metodos.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Hoy aún no hay métodos con pagos.
                </p>
              ) : (
                metodos.map((m) => (
                  <div key={m.metodo} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {METODO_LABEL[m.metodo] ?? m.metodo}
                    </span>
                    <span className="font-semibold tabular-nums">{fmtPEN(m.total)}</span>
                  </div>
                ))
              )}
              {sinMetodo.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {sinMetodo.map((m) => (
                    <Badge key={m} variant="gray">
                      {METODO_LABEL[m]}: S/ 0
                    </Badge>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
                <span className="font-medium">Total del día</span>
                <span className="font-bold tabular-nums">{fmtPEN(totalHoy)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function fmtDiaRelativo(d: Date | string | null): string {
  if (!d) return "—";
  try {
    return fmtFechaRelativa(
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date(d)),
    );
  } catch {
    return "—";
  }
}
