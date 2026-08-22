import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Eye, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { hasPermission, type StaffRole } from "@clinicflow/core";
import { auditLogs, getDb, patients, users } from "@clinicflow/db";
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
import { getSession, ROLE_INFO } from "@/lib/auth";
import { getDefaultTeam } from "@/lib/console-data";

export const dynamic = "force-dynamic";

const LIMITE = 100;

export default async function FichasVistasPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  const rol = session.role;
  if (!hasPermission(rol, "reports.view_all")) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="Acceso restringido"
            description="Tu rol no tiene permiso para ver el historial de accesos a fichas."
          />
        </Card>
      </div>
    );
  }

  const db = getDb();
  const filas = await db
    .select({
      id: auditLogs.id,
      entidadId: auditLogs.entidadId,
      payload: auditLogs.payload,
      createdAt: auditLogs.createdAt,
      userName: users.name,
      pacienteNombre: patients.nombre,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .leftJoin(
      patients,
      and(eq(auditLogs.entidadId, patients.id), eq(auditLogs.entidad, "patients")),
    )
    .where(and(eq(auditLogs.tenantId, team.id), eq(auditLogs.accion, "ficha.ver")))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(LIMITE);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Historia vista por"
        description="Cada lectura de una ficha clínica queda registrada aquí (Ley 29733, dato sensible)."
      />

      {filas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Eye}
            title="Aún no hay lecturas registradas"
            description="Cuando el equipo abra una ficha clínica, el acceso se registrará automáticamente."
          />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Momento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((fila) => {
                const rolLog = (fila.payload as { rol?: string } | null)?.rol;
                const rolLabel =
                  rolLog && rolLog in ROLE_INFO
                    ? ROLE_INFO[rolLog as StaffRole].label
                    : rolLog ?? "—";
                return (
                  <TableRow key={fila.id}>
                    <TableCell>
                      <p className="text-sm font-medium">
                        {fila.pacienteNombre ?? "Paciente eliminado"}
                      </p>
                      {fila.entidadId ? (
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {fila.entidadId.slice(0, 8)}…
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{fila.userName ?? "Sistema"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{rolLabel}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span title={`Hora exacta: ${format(fila.createdAt, "HH:mm")}`}>
                        {formatDistanceToNow(fila.createdAt, {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
