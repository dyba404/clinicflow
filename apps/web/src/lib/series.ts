import { and, eq } from "drizzle-orm";
import { getDb, appointments, appointmentSeries, services } from "@clinicflow/db";
import { logAudit } from "@/lib/audit";
import { sucursalActiva } from "@/lib/branch";
import { horaFinDesde, horarioOcupado } from "@/app/api/citas/solape";

export type FrecuenciaSerie = "semanal" | "quincenal" | "mensual";

const FRECUENCIA_DIAS: Record<FrecuenciaSerie, number> = {
  semanal: 7,
  quincenal: 14,
  mensual: 30,
};

export function esFrecuencia(v: string): v is FrecuenciaSerie {
  return v === "semanal" || v === "quincenal" || v === "mensual";
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(d);
}

export async function crearSerie(opts: {
  tenantId: string;
  patientId: string;
  serviceId: string;
  doctorId: string | null;
  titulo: string;
  frecuencia: FrecuenciaSerie;
  fechaInicio: string;
  horaIni: string;
  totalSesiones: number;
  createdBy: string;
}): Promise<{
  serieId: string;
  creadas: number;
  omitidas: number;
  citas: Array<{ id: string; fecha: string; horaIni: string }>;
}> {
  const db = getDb();

  const [service] = await db
    .select()
    .from(services)
    .where(
      and(
        eq(services.id, opts.serviceId),
        eq(services.tenantId, opts.tenantId),
        eq(services.activo, true),
      ),
    )
    .limit(1);
  if (!service) throw new Error("servicio_invalido");

  const horaFin = horaFinDesde(opts.horaIni, service.duracionMin);
  if (!horaFin) throw new Error("hora_invalida");

  const [serie] = await db
    .insert(appointmentSeries)
    .values({
      tenantId: opts.tenantId,
      patientId: opts.patientId,
      serviceId: opts.serviceId,
      doctorId: opts.doctorId,
      titulo: opts.titulo,
      frecuencia: opts.frecuencia,
      horaIni: opts.horaIni,
      totalSesiones: opts.totalSesiones,
      createdBy: opts.createdBy,
    })
    .returning({ id: appointmentSeries.id });

  const branchId = await sucursalActiva(opts.tenantId);
  const paso = FRECUENCIA_DIAS[opts.frecuencia];
  const citas: Array<{ id: string; fecha: string; horaIni: string }> = [];
  let omitidas = 0;
  let fecha = opts.fechaInicio;
  let n = 0;

  while (n < opts.totalSesiones) {
    let ocupado = false;
    if (opts.doctorId) {
      ocupado = await horarioOcupado({
        tenantId: opts.tenantId,
        fecha,
        horaIni: opts.horaIni,
        horaFin,
        doctorId: opts.doctorId,
      });
    }

    if (ocupado) {
      omitidas++;
    } else {
      n++;
      try {
        const [appt] = await db
          .insert(appointments)
          .values({
            tenantId: opts.tenantId,
            branchId,
            serviceId: opts.serviceId,
            patientId: opts.patientId,
            doctorId: opts.doctorId,
            preferredDoctorId: opts.doctorId,
            fecha,
            horaIni: opts.horaIni,
            horaFin,
            estado: "confirmada",
            modoSolicitud: false,
            monto: service.precio,
            seriesId: serie!.id,
            seriesN: n,
            createdBy: opts.createdBy,
          })
          .returning({ id: appointments.id, fecha: appointments.fecha, horaIni: appointments.horaIni });
        if (appt) citas.push(appt);
      } catch (e) {
        if (e instanceof Error && /appointments_no_overlap/i.test(e.message)) {
          omitidas++;
          n--;
        } else {
          throw e;
        }
      }
    }
    fecha = sumarDias(fecha, paso);
  }

  await db
    .update(appointmentSeries)
    .set({ creadas: citas.length, omitidas, updatedAt: new Date() })
    .where(eq(appointmentSeries.id, serie!.id));

  void logAudit({
    tenantId: opts.tenantId,
    accion: "serie.crear",
    entidad: "appointment_series",
    entidadId: serie!.id,
    payload: {
      frecuencia: opts.frecuencia,
      totalSesiones: opts.totalSesiones,
      creadas: citas.length,
      omitidas,
    },
  });

  return { serieId: serie!.id, creadas: citas.length, omitidas, citas };
}

export async function cancelarSerie(opts: {
  tenantId: string;
  serieId: string;
  userId: string;
}): Promise<{ canceladas: number }> {
  const db = getDb();
  const filas = await db
    .update(appointments)
    .set({ estado: "cancelada", updatedAt: new Date() })
    .where(
      and(
        eq(appointments.tenantId, opts.tenantId),
        eq(appointments.seriesId, opts.serieId),
        eq(appointments.estado, "confirmada"),
      ),
    )
    .returning({ id: appointments.id });

  await db
    .update(appointmentSeries)
    .set({ estado: "cancelada", updatedAt: new Date() })
    .where(eq(appointmentSeries.id, opts.serieId));

  void logAudit({
    tenantId: opts.tenantId,
    accion: "serie.cancelar",
    entidad: "appointment_series",
    entidadId: opts.serieId,
    payload: { canceladas: filas.length, por: opts.userId },
  });

  return { canceladas: filas.length };
}
