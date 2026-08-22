import { Lock, Star } from "lucide-react";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { hasPermission } from "@clinicflow/core";
import { getDb, reviewRequests, patients, appointments, services, teams } from "@clinicflow/db";
import { Card, CardContent } from "@/components/ui/card";
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
import { MarcarRespondidaButton, NuevaSolicitudDialog } from "@/app/consola/reviews/acciones";
import { ConfigDialog } from "@/app/consola/reviews/config-dialog";
import { getDefaultTeam } from "@/lib/console-data";
import { getSession, hoyTenant } from "@/lib/auth";

export const dynamic = "force-dynamic";

function fechaLarga(fecha: string): string {
  return format(new Date(`${fecha}T12:00:00`), "d 'de' MMMM 'de' yyyy", { locale: es });
}

export default async function ReviewsPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "reminders.send")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Reseñas de Google"
          description="Pide reseñas a tus pacientes atendidos y mide la respuesta."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo los roles Dueña y Recepción pueden enviar solicitudes de reseña."
          />
        </Card>
      </div>
    );
  }

  const db = getDb();

  const [requests, teamInfo] = await Promise.all([
    db
      .select({
        id: reviewRequests.id,
        enviadoAt: reviewRequests.enviadoAt,
        respondido: reviewRequests.respondido,
        respondidoAt: reviewRequests.respondidoAt,
        canal: reviewRequests.canal,
        patientId: reviewRequests.patientId,
        nombre: patients.nombre,
        citaFecha: appointments.fecha,
        servicio: services.nombre,
      })
      .from(reviewRequests)
      .innerJoin(patients, eq(reviewRequests.patientId, patients.id))
      .leftJoin(appointments, eq(reviewRequests.appointmentId, appointments.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(eq(reviewRequests.tenantId, team.id))
      .orderBy(desc(reviewRequests.createdAt))
      .limit(200),
    db
      .select({ googlePlaceId: teams.googlePlaceId, googleReviewUrl: teams.googleReviewUrl })
      .from(teams)
      .where(eq(teams.id, team.id))
      .limit(1),
  ]);

  const hoy = await hoyTenant(team.timezone);
  const atendidasHoy = await db
    .select({
      appointmentId: appointments.id,
      patientId: appointments.patientId,
      patientNombre: patients.nombre,
      patientEmail: patients.email,
      servicio: services.nombre,
      horaIni: appointments.horaIni,
      solicitudId: reviewRequests.id,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(reviewRequests, eq(reviewRequests.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.tenantId, team.id),
        eq(appointments.fecha, hoy),
        eq(appointments.estado, "atendida"),
      ),
    );

  const candidatas = atendidasHoy
    .filter((a) => !a.solicitudId)
    .map((a) => ({
      patientId: a.patientId,
      appointmentId: a.appointmentId,
      nombre: a.patientNombre,
      servicio: a.servicio,
      horaIni: a.horaIni,
    }));

  const enviadas = requests.length;
  const respondidas = requests.filter((r) => r.respondido).length;
  const tasa = enviadas === 0 ? 0 : Math.round((respondidas / enviadas) * 100);
  const cfg = teamInfo[0];
  const resenasConfiguradas = Boolean(cfg?.googleReviewUrl || cfg?.googlePlaceId);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Reseñas de Google"
        description="Pide reseñas a tus pacientes atendidos y mide la respuesta."
        action={
          <div className="flex items-center gap-2">
            <ConfigDialog
              googlePlaceId={cfg?.googlePlaceId ?? null}
              googleReviewUrl={cfg?.googleReviewUrl ?? null}
            />
            <NuevaSolicitudDialog candidatas={candidatas} />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Solicitudes enviadas" value={String(enviadas)} sub="total histórico" />
        <Stat label="Respondidas" value={String(respondidas)} sub="reseñas recibidas" />
        <Stat label="Tasa de respuesta" value={`${tasa}%`} sub="de las enviadas" />
      </div>

      {!resenasConfiguradas && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Star className="size-4 shrink-0 text-amber-600" />
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              Aún no configuras tu enlace de reseñas. Usa el botón “Configurar enlace”
              para pegar tu URL o Place ID de Google.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        {enviadas === 0 ? (
          <EmptyState
            icon={Star}
            title="Sin solicitudes todavía"
            description="Cuando un paciente termine su cita, usa “Nueva solicitud” para enviarle el correo con el enlace de reseña."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Cita</TableHead>
                <TableHead>Enviada</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm font-medium">{r.nombre}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.citaFecha ? `${fechaLarga(r.citaFecha)}` : "—"}
                    {r.servicio ? ` · ${r.servicio}` : ""}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {r.enviadoAt
                      ? format(r.enviadoAt, "d MMM yyyy HH:mm", { locale: es })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {r.respondido ? (
                      <Badge variant="green">Respondida</Badge>
                    ) : (
                      <Badge variant="amber">Enviada</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!r.respondido ? <MarcarRespondidaButton id={r.id} /> : null}
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
