import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission } from "@clinicflow/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { Lock, Stethoscope, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSession } from "@/lib/auth";
import { getDefaultTeam, produccionPorDoctor, produccionDoctorDetalle } from "@/lib/console-data";
import { gatePlan } from "@/lib/plans";
import { PlanGate } from "@/components/console/plan-gate";
import { fmtPEN } from "@/lib/format";
import { ProduccionPeriodos } from "./produccion-periodos";

export const dynamic = "force-dynamic";

function rangoPeriodo(timezone: string, periodo: string): { desde: string; hasta: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
  const ahora = new Date();
  const hasta = fmt.format(ahora);
  const dias = periodo === "dia" ? 0 : periodo === "semana" ? 6 : 29;
  const desde = fmt.format(new Date(ahora.getTime() - dias * 86_400_000));
  return { desde, hasta };
}

const PERIODO_LABEL: Record<string, string> = {
  dia: "hoy",
  semana: "últimos 7 días",
  mes: "últimos 30 días",
};

export default async function ProduccionPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; doctorId?: string }>;
}) {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "reports.view_all")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Producción por doctor"
          description="Ventas, atenciones y ticket promedio por profesional."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Tu rol no tiene permiso para ver los reportes de producción."
          />
        </Card>
      </div>
    );
  }

  const planCheck = await gatePlan(team.id, "dashboard");
  if (!planCheck.ok) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Producción por doctor"
          description="Ventas, atenciones y ticket promedio por profesional."
        />
        <PlanGate feature="dashboard" requerido={planCheck.requerido} />
      </div>
    );
  }

  const sp = await searchParams;
  const periodo = sp.periodo === "dia" || sp.periodo === "semana" || sp.periodo === "mes" ? sp.periodo : "mes";
  const { desde, hasta } = rangoPeriodo(team.timezone, periodo);

  const filas = await produccionPorDoctor(team.id, desde, hasta);
  const totalVentas = filas.reduce((acc, f) => acc + f.ventas, 0);
  const totalAtendidas = filas.reduce((acc, f) => acc + f.atendidas, 0);

  const doctorSel = sp.doctorId ? filas.find((f) => f.doctorId === sp.doctorId) : null;
  const detalle = doctorSel?.doctorId
    ? await produccionDoctorDetalle(team.id, doctorSel.doctorId, desde, hasta)
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Producción por doctor"
        description={`Ventas, atenciones y ticket promedio ${PERIODO_LABEL[periodo]}.`}
        action={<ProduccionPeriodos periodo={periodo} />}
      />

      {filas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Stethoscope}
            title="Sin citas en el periodo"
            description="Cuando haya citas con doctor asignado verás aquí su producción."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-medium text-muted-foreground">Ventas del periodo</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtPEN(totalVentas)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-medium text-muted-foreground">Atenciones realizadas</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{totalAtendidas}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-medium text-muted-foreground">Profesionales</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{filas.length}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="p-5 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="size-4 text-primary" />
                Producción por profesional
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor</TableHead>
                  <TableHead className="text-center">Atendidas</TableHead>
                  <TableHead className="text-center">No-shows</TableHead>
                  <TableHead className="text-center">Pagos</TableHead>
                  <TableHead className="text-right">Ticket prom.</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => (
                  <TableRow key={f.doctorId ?? "sin-doctor"}>
                    <TableCell>
                      {f.doctorId ? (
                        <Link
                          href={`/consola/produccion?periodo=${periodo}&doctorId=${f.doctorId}`}
                          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {f.doctorNombre}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">{f.doctorNombre}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm tabular-nums">{f.atendidas}</TableCell>
                    <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                      {f.noShows}
                    </TableCell>
                    <TableCell className="text-center text-sm tabular-nums">{f.pagos}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{fmtPEN(f.ticket)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {fmtPEN(f.ventas)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="px-5 pb-4 pt-2 text-xs text-muted-foreground">
              Haz clic en un doctor para ver el detalle de sus citas y pagos en el periodo.
            </p>
          </Card>

          {doctorSel && detalle ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-2">
                <CardTitle className="text-sm font-medium">
                  Detalle: {doctorSel.doctorNombre}
                </CardTitle>
                <Link
                  href={`/consola/produccion?periodo=${periodo}`}
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  Ver todos
                </Link>
              </CardHeader>
              <CardContent className="space-y-4 p-5 pt-0">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Citas del periodo ({detalle.citas.length})
                  </p>
                  {detalle.citas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin citas registradas.</p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Hora</TableHead>
                            <TableHead>Paciente</TableHead>
                            <TableHead>Servicio</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detalle.citas.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell className="text-sm tabular-nums">{c.fecha}</TableCell>
                              <TableCell className="text-sm tabular-nums">{c.horaIni}</TableCell>
                              <TableCell className="text-sm">{c.paciente ?? "—"}</TableCell>
                              <TableCell className="text-sm">{c.servicio}</TableCell>
                              <TableCell>
                                <Badge variant="gray">{c.estado}</Badge>
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums">
                                {fmtPEN(Number(c.monto))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Pagos del periodo ({detalle.pagos.length})
                  </p>
                  {detalle.pagos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detalle.pagos.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="text-sm tabular-nums">
                                {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(p.createdAt)}
                              </TableCell>
                              <TableCell className="text-sm capitalize">{p.metodo}</TableCell>
                              <TableCell className="text-right text-sm tabular-nums">
                                {fmtPEN(Number(p.monto))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
