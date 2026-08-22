import { Lock, PartyPopper } from "lucide-react";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { hasPermission } from "@clinicflow/core";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RecordarButton, RecordarTodos } from "@/app/consola/recall/recordar-botones";
import { getDefaultTeam, pacientesDormidos } from "@/lib/console-data";
import { getSession } from "@/lib/auth";
import { mailConfigurado } from "@/lib/mail";

export const dynamic = "force-dynamic";

const ESTADO_BADGE: Record<string, "red" | "amber" | "green"> = {
  dormido: "red",
  en_riesgo: "amber",
  activo: "green",
};

const ESTADO_LABEL: Record<string, string> = {
  dormido: "Dormido",
  en_riesgo: "En riesgo",
  activo: "Activo",
};

function fechaLarga(fecha: string): string {
  return format(new Date(`${fecha}T12:00:00`), "d 'de' MMMM 'de' yyyy", { locale: es });
}

export default async function RecallPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");
  const role = session.role;
  const emailListo = mailConfigurado();

  if (!hasPermission(role, "reminders.send")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Recall"
          description="Pacientes sin visita hace 6 meses o más: recuérdales volver."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo los roles Dueña y Recepción pueden enviar recordatorios a los pacientes."
          />
        </Card>
      </div>
    );
  }

  const todos = await pacientesDormidos(team.id);
  const dormidos = todos.filter((p) => p.estado === "dormido").length;
  const enRiesgo = todos.filter((p) => p.estado === "en_riesgo").length;
  const activos = todos.filter((p) => p.estado === "activo").length;

  const objetivo = todos
    .filter((p) => p.estado !== "activo")
    .sort((a, b) => b.mesesSinVisita - a.mesesSinVisita);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Recall"
        description="Pacientes sin visita hace 6 meses o más: recuérdales volver."
        action={
          objetivo.length > 0 ? (
            <RecordarTodos total={objetivo.length} pacienteIds={objetivo.map((p) => p.id)} />
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Dormidos (≥6m)" value={String(dormidos)} sub="6 meses o más sin venir" />
        <Stat label="En riesgo (4-5m)" value={String(enRiesgo)} sub="4 a 5 meses sin venir" />
        <Stat label="Activos (<4m)" value={String(activos)} sub="menos de 4 meses" />
      </div>

      <Card>
        <CardHeader className="p-5 pb-4">
          <CardTitle className="text-sm font-medium">Pacientes dormidos y en riesgo</CardTitle>
        </CardHeader>
        {objetivo.length === 0 ? (
          <EmptyState
            icon={PartyPopper}
            title="Sin pacientes dormidos"
            description="¡Excelente! Todos tus pacientes han vuelto dentro de los últimos 4 meses. Sigue así."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Celular</TableHead>
                <TableHead>Última visita</TableHead>
                <TableHead className="text-right">Meses sin venir</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {objetivo.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm font-medium">{p.nombre}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.celular}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {p.ultimaVisita ? fechaLarga(p.ultimaVisita) : "Nunca"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {p.mesesSinVisita}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ESTADO_BADGE[p.estado] ?? "gray"}>
                      {ESTADO_LABEL[p.estado] ?? p.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <RecordarButton pacienteId={p.id} nombre={p.nombre} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="border-t px-5 py-3 text-xs text-muted-foreground">
          {emailListo
            ? "Los recordatorios se envían por email al instante y quedan en el historial."
            : "Para enviar recordatorios por email configura RESEND_API_KEY. Sin clave, el botón muestra el error."}
        </div>
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
