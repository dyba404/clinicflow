import { ArrowLeft, Building2, CalendarDays, Users } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { PlanEditor } from "@/app/admin/plan-editor";
import { MembersPanel } from "@/app/admin/members-panel";
import { panelAdmin } from "@/lib/console-data";
import { requirePlatformSession } from "@/lib/guard-sesion";

export const dynamic = "force-dynamic";

const ESTADO_LABEL: Record<string, string> = {
  activo: "Activo",
  por_renovar: "Por renovar",
  suspendido: "Suspendido",
  cancelado: "Cancelado",
};

const fmtVence = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function AdminPage() {
  await requirePlatformSession();

  const panel = await panelAdmin();

  const tenantsActivos = panel.tenants.filter(
    (t) => t.estado !== "suspendido" && t.estado !== "cancelado",
  ).length;
  const pacientesTotales = panel.tenants.reduce((acc, t) => acc + t.pacientes, 0);
  const citasHoy = panel.tenants.reduce((acc, t) => acc + t.citasHoy, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Administración de la plataforma"
        description="Panel interno del operador: tenants, planes y actividad del día."
        action={
          <Link
            href="/consola/dashboard"
            className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-card px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="size-4" />
            Volver a la consola
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={Building2}
          label="Tenants activos"
          value={String(tenantsActivos)}
          sub={`de ${panel.tenants.length} registrados`}
        />
        <Stat
          icon={Users}
          label="Pacientes totales"
          value={String(pacientesTotales)}
          sub="en toda la red"
        />
        <Stat
          icon={CalendarDays}
          label="Citas de hoy"
          value={String(citasHoy)}
          sub={panel.today}
        />
      </div>

      <Card>
        <CardHeader className="p-5 pb-2">
          <CardTitle className="text-sm font-medium">Tenants</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {panel.tenants.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Sin tenants registrados"
              description="Todavía ninguna clínica usa Clinicflow."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Miembros</TableHead>
                  <TableHead className="text-right">Pacientes</TableHead>
                  <TableHead className="text-right">Citas hoy</TableHead>
                  <TableHead className="text-right">Vence</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {panel.tenants.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <p className="font-medium">{t.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {t.slug}
                      </p>
                    </TableCell>
                    <TableCell>
                      {t.plan === "premium" ? (
                        <Badge variant="violet">Premium</Badge>
                      ) : t.plan === "pro" ? (
                        <Badge className="bg-primary/10 text-primary">Pro</Badge>
                      ) : t.plan === "free" ? (
                        <Badge variant="outline">Free</Badge>
                      ) : (
                        <Badge variant="gray">Sin plan</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.estado === "activo" ? (
                        <Badge variant="green">Activo</Badge>
                      ) : t.estado === "por_renovar" ? (
                        <Badge variant="amber">Por renovar</Badge>
                      ) : t.estado === "suspendido" || t.estado === "cancelado" ? (
                        <Badge variant="red">{ESTADO_LABEL[t.estado]}</Badge>
                      ) : (
                        <Badge variant="gray">—</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.miembros}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.pacientes}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.citasHoy}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                      {t.vence
                        ? fmtVence.format(new Date(`${t.vence}T00:00:00`))
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <MembersPanel tenantId={t.id} />
                        <PlanEditor
                          tenantId={t.id}
                          tenantName={t.name}
                          iniciales={{
                            plan: t.plan,
                            estado: t.estado,
                            vence: t.vence,
                            monto: t.monto,
                            nota: t.nota,
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex min-h-[110px] flex-col justify-between rounded-2xl border bg-card p-5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <div className="mt-3">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </span>
        <span className="ml-2 text-xs text-muted-foreground tabular-nums">{sub}</span>
      </div>
    </div>
  );
}
