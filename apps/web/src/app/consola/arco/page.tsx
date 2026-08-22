import { desc, eq } from "drizzle-orm";
import { ShieldCheck, UserX } from "lucide-react";
import { redirect } from "next/navigation";
import { hasPermission } from "@clinicflow/core";
import { getDb, dataRequests, patients, users } from "@clinicflow/db";
import { Card } from "@/components/ui/card";
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
import { getSession } from "@/lib/auth";
import { getDefaultTeam } from "@/lib/console-data";
import { SolicitudDialog } from "./solicitud-dialog";
import { ArcoAcciones } from "./acciones";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  acceso: "Acceso",
  rectificacion: "Rectificación",
  cancelacion: "Cancelación",
  oposicion: "Oposición",
};

const TIPO_BADGE: Record<string, "blue" | "amber" | "red" | "violet"> = {
  acceso: "blue",
  rectificacion: "amber",
  cancelacion: "red",
  oposicion: "violet",
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  atendida: "Atendida",
  rechazada: "Rechazada",
};

const ESTADO_BADGE: Record<string, "secondary" | "green" | "red"> = {
  pendiente: "secondary",
  atendida: "green",
  rechazada: "red",
};

function fechaCorta(d: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(d);
}

export default async function ArcoPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "reports.view_all")) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Acceso restringido"
            description="Solo dueños pueden gestionar solicitudes ARCO (Ley 29733)."
          />
        </Card>
      </div>
    );
  }

  const filas = await getDb()
    .select({
      id: dataRequests.id,
      tipo: dataRequests.tipo,
      estado: dataRequests.estado,
      detalle: dataRequests.detalle,
      createdAt: dataRequests.createdAt,
      paciente: patients.nombre,
      gestionado: users.name,
    })
    .from(dataRequests)
    .leftJoin(patients, eq(dataRequests.patientId, patients.id))
    .leftJoin(users, eq(dataRequests.gestionadoPor, users.id))
    .where(eq(dataRequests.tenantId, team.id))
    .orderBy(desc(dataRequests.createdAt));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="ARCO (Ley 29733)"
        description="Solicitudes de Acceso, Rectificación, Cancelación y Oposición sobre datos personales de pacientes."
        action={<SolicitudDialog />}
      />

      <Card>
        {filas.length === 0 ? (
          <EmptyState
            icon={UserX}
            title="Aún no hay solicitudes ARCO"
            description="Registra aquí las solicitudes de datos personales que presenten tus pacientes, y atiéndelas dentro de los plazos de ley."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Gestionado por</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="whitespace-nowrap text-sm font-medium">
                    {f.paciente ?? <span className="text-muted-foreground">Paciente eliminado</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={TIPO_BADGE[f.tipo] ?? "gray"}>
                      {TIPO_LABEL[f.tipo] ?? f.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ESTADO_BADGE[f.estado] ?? "gray"}>
                      {ESTADO_LABEL[f.estado] ?? f.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">
                    {f.detalle ? (
                      <span className="line-clamp-2">{f.detalle}</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {fechaCorta(f.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">{f.gestionado ?? "—"}</TableCell>
                  <TableCell>
                    <ArcoAcciones id={f.id} paciente={f.paciente ?? "este paciente"} estado={f.estado} />
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
