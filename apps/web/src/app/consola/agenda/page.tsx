import { redirect } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { PageHeader } from "@/components/console/page-header";
import { getSession } from "@/lib/auth";
import {
  getDefaultTeam,
  doctoresConColor,
  pacientesBasicos,
  citasDelDia,
  citasEnRango,
  bloqueosDia,
} from "@/lib/console-data";
import { NuevaCitaDialog } from "./nueva-cita-dialog";
import { BloquearDialog } from "./bloquear-dialog";
import { AgendaToolbar } from "./agenda-toolbar";
import { VistaDia } from "./vista-dia";
import { VistaSemana } from "./vista-semana";
import { VistaMes } from "./vista-mes";

export const dynamic = "force-dynamic";

type Vista = "dia" | "semana" | "mes";

type AgendaDoctor = Awaited<ReturnType<typeof doctoresConColor>>[number];
type CitasDia = Awaited<ReturnType<typeof citasDelDia>>;
type CitasRango = Awaited<ReturnType<typeof citasEnRango>>;
type Bloqueos = Awaited<ReturnType<typeof bloqueosDia>>;

const SIN_CITAS_DIA: CitasDia = [];
const SIN_CITAS_RANGO: CitasRango = [];
const SIN_BLOQUEOS: Bloqueos = [];

function hoyLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

function parseFecha(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function labelRango(vista: Vista, fecha: Date, lunes: Date, domingo: Date): string {
  if (vista === "dia") return format(fecha, "d MMM yyyy", { locale: es });
  if (vista === "semana") {
    if (lunes.getMonth() === domingo.getMonth()) {
      return `Semana del ${format(lunes, "d", { locale: es })} al ${format(domingo, "d MMM", { locale: es })}`;
    }
    return `Semana del ${format(lunes, "d MMM", { locale: es })} al ${format(domingo, "d MMM", { locale: es })}`;
  }
  return format(fecha, "MMMM yyyy", { locale: es });
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; fecha?: string }>;
}) {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");
  const role = session.role;

  const params = await searchParams;
  const vista: Vista = params.vista === "semana" || params.vista === "mes" ? params.vista : "dia";
  const hoy = hoyLima();
  const fechaISO = parseFecha(params.fecha) ? (params.fecha as string) : hoy;
  const fecha = parseFecha(fechaISO) ?? new Date(`${hoy}T00:00:00`);

  const lunes = startOfWeek(fecha, { weekStartsOn: 1 });
  const domingo = addDays(lunes, 6);
  const gridIni = startOfWeek(startOfMonth(fecha), { weekStartsOn: 1 });
  const gridFin = addDays(gridIni, 41);

  const esDoctor = role === "doctor";
  const miMembershipId = esDoctor ? session.membershipId : null;

  const [doctores, pacientes] = await Promise.all([
    doctoresConColor(team.id),
    pacientesBasicos(team.id),
  ]);

  const doctoresVisibles: AgendaDoctor[] = esDoctor
    ? doctores.filter((d) => d.id === miMembershipId)
    : doctores;
  const colorPorDoctor = new Map(doctores.map((d) => [d.id, d.color ?? "#64748b"]));

  const filtrarDoctor = <T extends { doctorId: string | null }>(rows: T[]): T[] =>
    esDoctor ? rows.filter((r) => r.doctorId === miMembershipId) : rows;

  const [citasDiaBase, bloqueos] =
    vista === "dia"
      ? await Promise.all([citasDelDia(team.id, fechaISO), bloqueosDia(team.id, fechaISO)])
      : ([SIN_CITAS_DIA, SIN_BLOQUEOS] as const);
  const citasSemana: CitasRango =
    vista === "semana"
      ? await citasEnRango(team.id, format(lunes, "yyyy-MM-dd"), format(domingo, "yyyy-MM-dd"))
      : SIN_CITAS_RANGO;
  const citasMes: CitasRango =
    vista === "mes"
      ? await citasEnRango(team.id, format(gridIni, "yyyy-MM-dd"), format(gridFin, "yyyy-MM-dd"))
      : SIN_CITAS_RANGO;

  const citasDia = filtrarDoctor(citasDiaBase);
  const citasRangoSemana = filtrarDoctor(citasSemana);
  const citasRangoMes = filtrarDoctor(citasMes);

  const anterior =
    vista === "dia" ? addDays(fecha, -1) : vista === "semana" ? addWeeks(fecha, -1) : addMonths(fecha, -1);
  const siguiente =
    vista === "dia" ? addDays(fecha, 1) : vista === "semana" ? addWeeks(fecha, 1) : addMonths(fecha, 1);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title={esDoctor ? "Mi agenda" : "Agenda"}
        description={format(fecha, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
        action={
          <div className="flex items-center gap-2">
            {vista === "dia" ? (
              <BloquearDialog
                fechaISO={fechaISO}
                doctores={doctoresVisibles.map((d) => ({ id: d.id, name: d.name }))}
                esDoctor={esDoctor}
              />
            ) : null}
            <NuevaCitaDialog teamSlug={team.slug} doctores={doctores} pacientes={pacientes} />
          </div>
        }
      />

      <AgendaToolbar
        vista={vista}
        fechaISO={fechaISO}
        anteriorISO={format(anterior, "yyyy-MM-dd")}
        siguienteISO={format(siguiente, "yyyy-MM-dd")}
        hoyISO={hoy}
        label={labelRango(vista, fecha, lunes, domingo)}
        doctores={doctoresVisibles.map((d) => ({
          id: d.id,
          name: d.name,
          color: d.color ?? null,
        }))}
      />

      {vista === "dia" ? (
        <VistaDia
          fechaISO={fechaISO}
          citas={citasDia}
          bloqueos={bloqueos}
          doctores={doctoresVisibles}
          doctoresTodos={doctores}
          esDoctor={esDoctor}
        />
      ) : null}

      {vista === "semana" ? (
        <VistaSemana
          lunes={lunes}
          hoyISO={hoy}
          citas={citasRangoSemana}
          colorPorDoctor={colorPorDoctor}
        />
      ) : null}

      {vista === "mes" ? (
        <VistaMes
          gridIni={gridIni}
          fecha={fecha}
          hoyISO={hoy}
          citas={citasRangoMes}
          colorPorDoctor={colorPorDoctor}
        />
      ) : null}
    </div>
  );
}
