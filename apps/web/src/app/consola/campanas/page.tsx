import { Lock, Megaphone } from "lucide-react";
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
import { EjecutarCampana, NuevaCampanaDialog } from "@/app/consola/campanas/dialogs";
import { getSession } from "@/lib/auth";
import { getDb, campaigns } from "@clinicflow/db";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Audiencia = Array<{ patientId: string }>;

const TIPO_BADGE: Record<string, "teal" | "violet"> = {
  cumple: "teal",
  reactivacion: "violet",
};

const TIPO_LABEL: Record<string, string> = {
  cumple: "Cumpleaños",
  reactivacion: "Reactivación",
};

const ESTADO_BADGE: Record<string, "blue" | "green" | "red"> = {
  programada: "blue",
  completada: "green",
  error: "red",
};

const ESTADO_LABEL: Record<string, string> = {
  programada: "Programada",
  completada: "Completada",
  error: "Con errores",
};

export default async function CampanasPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "campaigns.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Campañas"
          description="Envía felicitaciones de cumpleaños y campañas de reactivación por email."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo los roles Dueño/a y Recepción pueden crear y ejecutar campañas."
          />
        </Card>
      </div>
    );
  }

  const filas = await getDb()
    .select()
    .from(campaigns)
    .where(eq(campaigns.tenantId, session.teamId))
    .orderBy(desc(campaigns.createdAt));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Campañas"
        description="Envía felicitaciones de cumpleaños y campañas de reactivación por email."
        action={<NuevaCampanaDialog />}
      />

      <Card>
        <CardHeader className="p-5 pb-4">
          <CardTitle className="text-sm font-medium">Campañas creadas</CardTitle>
        </CardHeader>
        {filas.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Aún no tienes campañas"
            description="Crea tu primera campaña de cumpleaños o reactivación con el botón Nueva campaña."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="text-right">Audiencia</TableHead>
                <TableHead className="text-right">Enviados</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creada</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((c) => {
                const audiencia = (c.audiencia as Audiencia).length;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Badge variant={TIPO_BADGE[c.tipo] ?? "gray"}>
                        {TIPO_LABEL[c.tipo] ?? c.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-sm font-medium">{c.titulo}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{audiencia}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {c.enviadosOk}/{c.enviadoA}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ESTADO_BADGE[c.estado] ?? "gray"}>
                        {ESTADO_LABEL[c.estado] ?? c.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(c.createdAt, "d MMM yyyy, HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.estado === "programada" ? (
                        <EjecutarCampana id={c.id} titulo={c.titulo} />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {c.ejecutadaAt
                            ? `Ejecutada ${format(c.ejecutadaAt, "d MMM yyyy, HH:mm", { locale: es })}`
                            : "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
