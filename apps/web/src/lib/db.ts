import { cache } from "react";
import { and, asc, eq, inArray, isNull, not } from "drizzle-orm";
import { generateSlots, parseTimeToMin } from "@clinicflow/core";
import {
  getDb,
  appointments,
  blockedSlots,
  memberships,
  services,
  staffSchedules,
  teams,
  users,
} from "@clinicflow/db";

export interface TenantContext {
  teamId: string;
  name: string;
  slug: string;
  timezone: string;
  bookingMode: string;
}

export const getTenantBySlug = cache(async (slug: string): Promise<TenantContext | null> => {
  const rows = await getDb()
    .select()
    .from(teams)
    .where(eq(teams.slug, slug))
    .limit(1);
  const t = rows[0];
  if (!t) return null;
  return {
    teamId: t.id,
    name: t.name,
    slug: t.slug,
    timezone: t.timezone,
    bookingMode: t.bookingMode,
  };
});

export async function listActiveServices(tenantId: string) {
  return getDb()
    .select({
      id: services.id,
      nombre: services.nombre,
      duracionMin: services.duracionMin,
      precio: services.precio,
      bufferMin: services.bufferMin,
    })
    .from(services)
    .where(and(eq(services.tenantId, tenantId), eq(services.activo, true)))
    .orderBy(asc(services.nombre));
}

export async function listDoctors(tenantId: string) {
  return getDb()
    .select({
      membershipId: memberships.id,
      name: users.name,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(
      and(
        eq(memberships.teamId, tenantId),
        eq(memberships.role, "doctor"),
        eq(memberships.active, true),
      ),
    )
    .orderBy(asc(users.name));
}

export const OCCUPYING_STATUSES = [
  "solicitada",
  "confirmada",
  "en_espera",
  "en_atencion",
] as const;

export interface SlotInfo {
  startTime: string;
  endTime: string;
}

export interface SlotsResult {
  date: string;
  slots: SlotInfo[];
}

async function doctorBusy(
  tenantId: string,
  membershipId: string,
  date: string,
) {
  const db = getDb();
  const appts = await db
    .select({ horaIni: appointments.horaIni, horaFin: appointments.horaFin })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.fecha, date),
        eq(appointments.doctorId, membershipId),
        inArray(appointments.estado, [...OCCUPYING_STATUSES]),
      ),
    );
  const blocked = await db
    .select({ doctorId: blockedSlots.doctorId, horaIni: blockedSlots.horaIni, horaFin: blockedSlots.horaFin })
    .from(blockedSlots)
    .where(and(eq(blockedSlots.tenantId, tenantId), eq(blockedSlots.fecha, date)));

  return [...appts, ...blocked]
    .filter((b) => "doctorId" in b ? (b.doctorId === membershipId || b.doctorId === null) : true)
    .map((b) => ({
      startMin: parseTimeToMin(b.horaIni),
      endMin: parseTimeToMin(b.horaFin),
    }));
}

export async function computeSlots(
  tenantId: string,
  opts: {
    serviceId: string;
    date: string;
    doctorMembershipId?: string | null;
    excluirCitaId?: string;
  },
): Promise<SlotsResult | null> {
  const db = getDb();

  const svcRows = await db
    .select({
      id: services.id,
      duracionMin: services.duracionMin,
      bufferMin: services.bufferMin,
    })
    .from(services)
    .where(and(eq(services.id, opts.serviceId), eq(services.tenantId, tenantId)))
    .limit(1);
  const service = svcRows[0];
  if (!service) return null;

  const doctorWhere = opts.doctorMembershipId
    ? eq(memberships.id, opts.doctorMembershipId)
    : undefined;

  const schedules = await db
    .select({
      membershipId: memberships.id,
      dayOfWeek: staffSchedules.dayOfWeek,
      horaIni: staffSchedules.horaIni,
      horaFin: staffSchedules.horaFin,
    })
    .from(staffSchedules)
    .innerJoin(memberships, eq(staffSchedules.membershipId, memberships.id))
    .where(
      and(
        eq(memberships.teamId, tenantId),
        eq(memberships.role, "doctor"),
        eq(memberships.active, true),
        doctorWhere,
      ),
    );

  const doctorIds = opts.doctorMembershipId
    ? [opts.doctorMembershipId]
    : schedules.length > 0
      ? [...new Set(schedules.map((s) => s.membershipId))]
      : [];

  if (doctorIds.length === 0) {
    return { date: opts.date, slots: [] };
  }

  // Ocupación del "bucket sin asignar": las citas sin doctor (y los bloqueos
  // sin doctor) ocupan la franja para FUTURAS citas sin asignar. Sin esto se
  // pueden apilar citas "Sin doctor asignado" en el mismo horario: la API de
  // creación las acepta todas y el día se llena de citas fantasma. (Las citas
  // sin asignar NO bloquean la agenda de un doctor puntual.)
  let noDoctorBusy: Array<{ startMin: number; endMin: number }> = [];
  if (!opts.doctorMembershipId) {
    const sinDoctorAppts = await db
      .select({ horaIni: appointments.horaIni, horaFin: appointments.horaFin })
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          eq(appointments.fecha, opts.date),
          isNull(appointments.doctorId),
          inArray(appointments.estado, [...OCCUPYING_STATUSES]),
          opts.excluirCitaId ? not(eq(appointments.id, opts.excluirCitaId)) : undefined,
        ),
      );
    const bloqueosSinDoctor = await db
      .select({ horaIni: blockedSlots.horaIni, horaFin: blockedSlots.horaFin })
      .from(blockedSlots)
      .where(
        and(
          eq(blockedSlots.tenantId, tenantId),
          eq(blockedSlots.fecha, opts.date),
          isNull(blockedSlots.doctorId),
        ),
      );
    noDoctorBusy = [...sinDoctorAppts, ...bloqueosSinDoctor].map((b) => ({
      startMin: parseTimeToMin(b.horaIni),
      endMin: parseTimeToMin(b.horaFin),
    }));
  }

  const windows = schedules.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    startMin: parseTimeToMin(s.horaIni),
    endMin: parseTimeToMin(s.horaFin),
  }));

  const seen = new Set<string>();
  let out: SlotInfo[] = [];

  for (const docId of doctorIds) {
    const busy = await doctorBusy(tenantId, docId, opts.date);
    const slots = generateSlots({
      date: opts.date,
      durationMin: service.duracionMin,
      bufferMin: service.bufferMin,
      stepMin: 15,
      leadTimeMin: 30,
      nowMin: null,
      windows,
      busy,
      maxSlots: 40,
    });
    for (const s of slots) {
      if (!seen.has(s.startTime)) {
        seen.add(s.startTime);
        out.push({ startTime: s.startTime, endTime: s.endTime });
      }
    }
  }

  // En modo "sin asignar", descarta las franjas ya ocupadas por citas sin
  // doctor: solo el primero gana.
  if (noDoctorBusy.length > 0) {
    out = out.filter((s) => {
      const ini = parseTimeToMin(s.startTime);
      const fin = parseTimeToMin(s.endTime);
      return !noDoctorBusy.some((b) => ini < b.endMin && b.startMin < fin);
    });
  }

  out.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return { date: opts.date, slots: out.slice(0, 40) };
}

export async function isSlotStillFree(
  tenantId: string,
  opts: { date: string; startTime: string; endTime: string; serviceId: string },
): Promise<boolean> {
  const result = await computeSlots(tenantId, {
    serviceId: opts.serviceId,
    date: opts.date,
  });
  if (!result) return false;
  return result.slots.some((s) => s.startTime === opts.startTime);
}
