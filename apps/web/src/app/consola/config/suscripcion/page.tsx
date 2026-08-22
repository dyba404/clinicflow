import { CreditCard, Lock, Sparkles, Check } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { RenovarYape } from "@/app/consola/config/suscripcion/renovar-yape";
import { getDefaultTeam, suscripcionTeam } from "@/lib/console-data";
import { getSession } from "@/lib/auth";
import { fmtPEN } from "@/lib/format";

export const dynamic = "force-dynamic";

const PLANES = [
  {
    codigo: "free",
    nombre: "Free",
    precio: 0,
    detalle: "Reservas y agenda",
    incluye: [
      "Página pública de reservas",
      "Agenda del día",
      "Cola de solicitudes",
      "Sala de espera y personal",
    ],
  },
  {
    codigo: "pro",
    nombre: "Pro",
    precio: 79,
    detalle: "Ficha clínica + recordatorios",
    incluye: [
      "Todo lo de Free",
      "Ficha clínica completa",
      "Recordatorios email/WhatsApp",
      "Recall y campañas básicas",
    ],
  },
  {
    codigo: "premium",
    nombre: "Premium",
    precio: 149,
    detalle: "Caja, facturación y ganancias",
    incluye: [
      "Todo lo de Pro",
      "Caja con Yape/Plin/POS",
      "Facturación electrónica SUNAT",
      "Dashboard de ingresos y márgenes",
      "Inventario, presupuestos y comisiones",
    ],
  },
];

const ESTADO_LABEL: Record<string, string> = {
  activo: "Activo",
  por_renovar: "Por renovar",
  suspendido: "Suspendido",
  cancelado: "Cancelado",
};

export default async function SuscripcionConfigPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (session.role !== "owner") {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Suscripción"
          description="Plan mensual de Clinicflow. El cobro es directo: Yape, Plin o transferencia."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo el rol Dueño puede ver la suscripción del equipo."
          />
        </Card>
      </div>
    );
  }

  const sub = await suscripcionTeam(team.id);
  const planActual = sub?.plan ?? "free";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Suscripción"
        description="Plan mensual de Clinicflow. El cobro es directo: Yape, Plin o transferencia."
      />

      <Card className="border-primary/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <CreditCard className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium">
                Plan actual:{" "}
                <span className="font-semibold capitalize">
                  {PLANES.find((p) => p.codigo === planActual)?.nombre ?? planActual}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {sub?.vence
                  ? `Vence el ${sub.vence}`
                  : "Activado manualmente por el equipo Clinicflow"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sub ? (
              <Badge variant={sub.estado === "activo" ? "green" : "amber"}>
                {ESTADO_LABEL[sub.estado] ?? sub.estado}
              </Badge>
            ) : null}
            <RenovarYape nombrePlan={PLANES.find((p) => p.codigo === planActual)?.nombre ?? "Clinicflow"} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANES.map((p) => {
          const activo = p.codigo === planActual;
          return (
            <Card
              key={p.codigo}
              className={activo ? "border-primary/50" : undefined}
            >
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{p.nombre}</p>
                  {activo ? <Badge variant="teal">Actual</Badge> : null}
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                  {p.precio === 0 ? "S/ 0" : fmtPEN(p.precio)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">/mes</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{p.detalle}</p>
                <ul className="mt-4 flex-1 space-y-2">
                  {p.incluye.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                {p.codigo === "premium" ? (
                  <div className="mt-4 flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
                    <Sparkles className="size-3.5" />
                    Incluye facturación electrónica SUNAT
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
