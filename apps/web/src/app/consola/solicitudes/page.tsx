import { Phone, ClipboardList } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { cn } from "@/lib/utils";
import { SolicitudActions } from "@/app/consola/solicitudes/solicitud-actions";
import { getDefaultTeam, solicitudesActivas } from "@/lib/console-data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

function diasRestantes(fecha: string): string {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  const a = new Date(`${hoy}T00:00:00`);
  const b = new Date(`${fecha}T00:00:00`);
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diff <= 0) return "hoy";
  if (diff === 1) return "mañana";
  return `en ${diff} días`;
}

export default async function SolicitudesPage() {
  const team = await getDefaultTeam();
  if (!team) redirect("/login");

  const solicitudes = await solicitudesActivas(team.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Solicitudes en línea"
        description="Pacientes que reservaron desde la página pública. Confirma o ajusta cada una."
        action={
          solicitudes.length > 0 && solicitudes[0] ? (
            <a
              href={`https://wa.me/${String(solicitudes[0].patientCelular ?? "").replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Phone className="size-4" />
              Llamar a la primera
            </a>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="teal">{solicitudes.length} pendientes</Badge>
        <span className="text-xs text-muted-foreground">
          Ordenadas por fecha de llegada
        </span>
      </div>

      {solicitudes.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="Cola al día"
            description="No hay solicitudes pendientes. Comparte la página pública de reservas para recibir nuevas."
            action={
              <Link
                href={`/${team.slug}/reserva`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-300 hover:bg-surface-hover hover:text-foreground"
              >
                <Phone className="size-3.5" />
                Abrir página pública
              </Link>
            }
          />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Propone</TableHead>
                <TableHead>Preferencia</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {solicitudes.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={s.patientNombre} />
                      <div>
                        <p className="text-sm font-medium">{s.patientNombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.patientCelular}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="teal">{s.servicio}</Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.servicioDuracion} min
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{s.fecha}</p>
                    <p className="text-xs font-medium text-amber-600">
                      {s.horaIni} · {diasRestantes(s.fecha)}
                    </p>
                  </TableCell>
                  <TableCell>
                    {s.preferredDoctorNombre ? (
                      <span className="text-sm">{s.preferredDoctorNombre}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Cualquier doctor
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-medium tabular-nums">
                    S/ {Number(s.monto).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <SolicitudActions
                      citaId={s.id}
                      paciente={s.patientNombre}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
