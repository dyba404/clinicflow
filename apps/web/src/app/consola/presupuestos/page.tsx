import { FileText, Lock } from "lucide-react";
import { redirect } from "next/navigation";
import { hasPermission } from "@clinicflow/core";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { fmtPEN } from "@/lib/format";
import { NuevoPresupuestoDialog } from "@/app/consola/presupuestos/nuevo-dialog";
import { PresupuestoDetalleDialog } from "@/app/consola/presupuestos/detalle-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb, quotes, patients } from "@clinicflow/db";
import { desc, eq } from "drizzle-orm";
import { getDefaultTeam } from "@/lib/console-data";
import { getSession } from "@/lib/auth";
import { gatePlan } from "@/lib/plans";
import { PlanGate } from "@/components/console/plan-gate";

export const dynamic = "force-dynamic";

const ESTADO_BADGE: Record<string, "gray" | "blue" | "green" | "red" | "violet"> = {
  borrador: "gray",
  enviado: "blue",
  aprobado: "green",
  rechazado: "red",
  convertido: "violet",
};

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  convertido: "Convertido",
};

function fmtCreado(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

export default async function PresupuestosPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "quotes.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Presupuestos"
          description="Planes de tratamiento con cotización, cuotas y seguimiento."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo los roles Dueña, Recepción y Médico pueden gestionar presupuestos."
          />
        </Card>
      </div>
    );
  }

  const planCheck = await gatePlan(team.id, "presupuestos");
  if (!planCheck.ok) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Presupuestos"
          description="Planes de tratamiento con cotización, cuotas y seguimiento."
        />
        <PlanGate feature="presupuestos" requerido={planCheck.requerido} />
      </div>
    );
  }

  const rows = await getDb()
    .select({
      id: quotes.id,
      patientId: quotes.patientId,
      patientNombre: patients.nombre,
      titulo: quotes.titulo,
      items: quotes.items,
      total: quotes.total,
      estado: quotes.estado,
      expiraEn: quotes.expiraEn,
      nota: quotes.nota,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .leftJoin(patients, eq(quotes.patientId, patients.id))
    .where(eq(quotes.tenantId, team.id))
    .orderBy(desc(quotes.createdAt))
    .limit(50);

  const presupuestos = rows.map((r) => ({
    ...r,
    itemsCount: Array.isArray(r.items) ? r.items.length : 0,
    totalNum: Number(r.total),
    itemsArr: Array.isArray(r.items)
      ? (r.items as Array<{
          servicioId?: string | null;
          descripcion: string;
          cantidad: number;
          precioUnitario: number;
        }>)
      : [],
  }));

  const borradores = presupuestos.filter((p) => p.estado === "borrador").length;
  const enviados = presupuestos.filter((p) => p.estado === "enviado").length;
  const aprobados = presupuestos.filter((p) => p.estado === "aprobado");
  const totalAprobado = aprobados.reduce((acc, p) => acc + p.totalNum, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Presupuestos"
        description="Planes de tratamiento con cotización, cuotas y seguimiento."
        action={<NuevoPresupuestoDialog />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Borradores" value={String(borradores)} sub="pendientes de enviar" />
        <Stat label="Enviados" value={String(enviados)} sub="esperando respuesta" />
        <Stat label="Aprobados" value={fmtPEN(totalAprobado)} sub={`${aprobados.length} presupuestos`} />
      </div>

      <Card>
        <CardHeader className="p-5 pb-4">
          <CardTitle className="text-sm font-medium">Presupuestos recientes</CardTitle>
        </CardHeader>
        {presupuestos.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sin presupuestos todavía"
            description="Crea el primer presupuesto para un paciente con el botón Nuevo presupuesto."
            action={<NuevoPresupuestoDialog />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Ítems</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {presupuestos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm font-medium">
                    {p.patientNombre ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-sm">{p.titulo}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">
                    {fmtPEN(p.totalNum)}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                    {p.itemsCount}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ESTADO_BADGE[p.estado] ?? "gray"}>
                      {ESTADO_LABEL[p.estado] ?? p.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {fmtCreado(p.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <PresupuestoDetalleDialog
                      presupuesto={{
                        id: p.id,
                        patientNombre: p.patientNombre ?? "—",
                        titulo: p.titulo,
                        estado: p.estado,
                        total: p.totalNum,
                        expiraEn: p.expiraEn,
                        nota: p.nota,
                        items: p.itemsArr,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
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
