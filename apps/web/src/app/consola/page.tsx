import Link from "next/link";
import { CalendarPlus, Wallet, Inbox, UserPlus, CheckCircle2, CircleDashed, Sparkles } from "lucide-react";
import { hasPermission } from "@clinicflow/core";
import type { AppointmentStatus } from "@clinicflow/core";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/console/empty-state";
import { getSession } from "@/lib/auth";
import {
  getDefaultTeam,
  teamOverview,
  doctorSchedule,
  doctoresConColor,
  primerosPasos,
} from "@/lib/console-data";
import { fmtPEN } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CalendarDays, ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

function saludoPorHora(): string {
  const hora = Number(
    new Intl.DateTimeFormat("es-PE", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Lima",
    }).format(new Date()),
  );
  if (hora >= 5 && hora < 12) return "Buenos días";
  if (hora >= 12 && hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

const insightLink =
  "font-medium text-foreground underline-offset-2 border-b border-dashed border-muted-foreground/40 transition-colors hover:border-foreground";

export default async function ConsolaPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");
  const role = session.role;

  const [overview, doctores] = await Promise.all([
    teamOverview(team.id),
    doctoresConColor(team.id),
  ]);
  const agenda = await doctorSchedule(team.id, overview.today);
  const pasos = role === "owner" ? await primerosPasos(team.id) : [];
  const pasosPendientes = pasos.filter((p) => !p.hecho);

  const firstName = session.name.split(" ")[0];
  const fechaLarga = new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${overview.today}T12:00:00`));

  const puedePagar = hasPermission(role, "payments.register");
  const puedeCheckin = hasPermission(role, "checkin.perform");
  const veSolicitudes = hasPermission(role, "appointments.edit");
  const puedeStaff = hasPermission(role, "staff.manage");

  const kpis: Array<{
    label: string;
    value: string;
    detail: string;
    href: string;
    hidden?: boolean;
  }> = [
    {
      label: "Citas de hoy",
      value: String(overview.citasHoy),
      detail: `${overview.atendidasHoy} atendidas`,
      href: "/consola/agenda",
    },
    {
      label: "Solicitudes pendientes",
      value: String(overview.solicitudesPendientes),
      detail: "por confirmar",
      href: "/consola/solicitudes",
      hidden: !veSolicitudes,
    },
    {
      label: "Cobrado hoy",
      value: fmtPEN(overview.ingresosHoy),
      detail: `${overview.pagosHoy.length} pagos`,
      href: "/consola/caja",
      hidden: !puedePagar,
    },
    {
      label: "Pacientes",
      value: String(overview.pacientesCount),
      detail: `${overview.miembros} en el equipo`,
      href: "/consola/pacientes",
    },
  ];
  const visibles = kpis.filter((k) => !k.hidden);

  const quickActions = [
    { label: "Nueva cita", icon: CalendarPlus, href: "/consola/agenda", show: true },
    { label: "Registrar pago", icon: Wallet, href: "/consola/caja", show: puedePagar },
    { label: "Sala de espera", icon: Inbox, href: "/consola/sala-espera", show: puedeCheckin },
    { label: "Invitar al equipo", icon: UserPlus, href: "/consola/personal", show: puedeStaff },
  ].filter((a) => a.show);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="mx-auto flex max-w-lg flex-col items-center pt-2 text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {saludoPorHora()},{" "}
          <span className="text-muted-foreground">{firstName}</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {veSolicitudes && overview.solicitudesPendientes > 0 ? (
            <>
              Tienes{" "}
              <Link href="/consola/solicitudes" className={insightLink}>
                {overview.solicitudesPendientes}{" "}
                {overview.solicitudesPendientes === 1
                  ? "solicitud pendiente"
                  : "solicitudes pendientes"}{" "}
                por confirmar
              </Link>
              {overview.citasHoy > 0
                ? ` y hoy hay ${overview.citasHoy} citas (${overview.confirmadasHoy} por atender).`
                : "."}
            </>
          ) : overview.citasHoy > 0 ? (
            <>
              Hoy hay{" "}
              <Link href="/consola/agenda" className={insightLink}>
                {overview.citasHoy} {overview.citasHoy === 1 ? "cita" : "citas"}
              </Link>
              , con {overview.atendidasHoy} ya atendidas.
            </>
          ) : (
            "Todo al día. Nada necesita tu atención."
          )}
        </p>
        <p className="mt-1 text-xs capitalize text-muted-foreground/70">{fechaLarga}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {visibles.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="group flex min-h-[110px] flex-col justify-between rounded-2xl border bg-card p-5 transition-all duration-300 hover:border-border hover:bg-surface-hover cursor-pointer"
          >
            <span className="text-xs text-muted-foreground">{kpi.label}</span>
            <span className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">
              {kpi.value}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {kpi.detail}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {quickActions.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="group flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-all duration-300 hover:bg-surface-hover hover:text-foreground [@media(pointer:coarse)]:min-h-12"
          >
            <a.icon className="size-3.5 text-muted-foreground/40 transition-colors duration-300 group-hover:text-foreground" />
            {a.label}
          </Link>
        ))}
      </div>

      {pasosPendientes.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 p-5 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <CardTitle className="text-sm font-medium">
                Primeros pasos
              </CardTitle>
              <Badge>
                {pasos.length - pasosPendientes.length}/{pasos.length}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              Se oculta cuando completes todo
            </span>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <ul className="divide-y divide-border-subtle">
              {pasos.map((p) => (
                <li key={p.id} className="py-2.5">
                  <Link
                    href={p.href}
                    className="group flex items-start gap-3 transition-opacity hover:opacity-80"
                  >
                    {p.hecho ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    ) : (
                      <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          p.hecho && "text-muted-foreground line-through",
                        )}
                      >
                        {p.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.detail}</p>
                    </div>
                    <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      {p.hecho ? "Ver" : "Hacer"} →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0 p-5 pb-4">
            <CardTitle className="text-sm font-medium">Agenda de hoy</CardTitle>
            <Link
              href="/consola/agenda"
              className="text-xs font-medium text-primary transition-opacity hover:opacity-70"
            >
              Ver agenda completa
            </Link>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {agenda.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Sin citas para hoy"
                description="Las citas confirmadas aparecerán aquí ordenadas por hora."
              />
            ) : (
              <ul className="divide-y divide-border-subtle">
                {agenda.slice(0, 8).map((a) => {
                  const doc = doctores.find((d) => d.id === a.doctorMembershipId);
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-[92px] shrink-0 text-sm font-medium tabular-nums">
                        {a.horaIni.slice(0, 5)}
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {a.horaFin.slice(0, 5)}
                        </span>
                      </span>
                      <Avatar name={a.patientNombre} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.patientNombre}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.serviceNombre}
                        </p>
                      </div>
                      {doc ? (
                        <span
                          className="hidden size-2.5 shrink-0 rounded-full sm:block"
                          style={{ background: doc.color }}
                          title={doc.name}
                        />
                      ) : null}
                      <StatusBadge status={a.estado as AppointmentStatus} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 p-5 pb-4">
            <CardTitle className="text-sm font-medium">Nuevas solicitudes</CardTitle>
            <Link
              href="/consola/solicitudes"
              className="text-xs font-medium text-primary transition-opacity hover:opacity-70"
            >
              Ver todas
            </Link>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {overview.pendientes.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Cola al día"
                description="Comparte tu página de reservas para recibir nuevas solicitudes."
              />
            ) : (
              <ul className="space-y-3">
                {overview.pendientes.slice(0, 4).map((s) => (
                  <li
                    key={s.id}
                    className="rounded-lg border border-border-subtle bg-muted/30 p-3 transition-colors duration-150 hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{s.patientNombre}</p>
                      <Badge variant="teal">{s.serviceNombre}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Propone: {s.fecha} · {s.horaIni.slice(0, 5)}
                      {s.preferredDoctorNombre ? ` · Prefiere a ${s.preferredDoctorNombre}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
