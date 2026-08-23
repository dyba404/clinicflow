import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { cache } from "react";
import { getSession } from "@/lib/auth";
import {
  getDb,
  teams,
  memberships,
  invitations,
  users,
  services,
  appointments,
  patients,
  payments,
  staffSchedules,
  subscriptions,
  blockedSlots,
  cashClosures,
  clinicalRecords,
  receipts,
  auditLogs,
  attachments,
  signedConsents,
  legalSettings,
} from "@clinicflow/db";

export async function serviciosActivosConsola(teamId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: services.id,
      nombre: services.nombre,
      duracionMin: services.duracionMin,
      precio: services.precio,
      bufferMin: services.bufferMin,
      activo: services.activo,
    })
    .from(services)
    .where(eq(services.tenantId, teamId))
    .orderBy(asc(services.nombre));
  const citasPorServicio = await db
    .select({
      serviceId: appointments.serviceId,
      total: sql<number>`count(${appointments.id})`.mapWith(Number),
    })
    .from(appointments)
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .where(
      and(eq(appointments.tenantId, teamId), eq(appointments.estado, "atendida")),
    )
    .groupBy(appointments.serviceId);
  const citasMap = new Map(citasPorServicio.map((r) => [r.serviceId, r.total]));
  return rows.map((r) => ({ ...r, citasAtendidas: citasMap.get(r.id) ?? 0 }));
}

export async function suscripcionTeam(teamId: string) {
  const db = getDb();
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, teamId)).limit(1);
  return sub ?? null;
}

export const getDefaultTeam = cache(async () => {
  const s = await getSession();
  if (!s) return null;
  const rows = await getDb().select().from(teams).where(eq(teams.id, s.teamId)).limit(1);
  return rows[0] ?? null;
});

export async function teamOverview(teamId: string) {
  const db = getDb();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

  const [apptsToday, pendientes, members, servicesCount, patientsCount, paymentsAll, solicitadas] = await Promise.all([
    db
      .select({
        id: appointments.id,
        estado: appointments.estado,
      })
      .from(appointments)
      .where(and(eq(appointments.tenantId, teamId), eq(appointments.fecha, today))),
    db
      .select({
        id: appointments.id,
        patientNombre: patients.nombre,
        serviceNombre: services.nombre,
        fecha: appointments.fecha,
        horaIni: appointments.horaIni,
        preferredDoctorNombre: users.name,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(memberships, eq(appointments.preferredDoctorId, memberships.id))
      .leftJoin(users, eq(memberships.userId, users.id))
      .where(and(eq(appointments.tenantId, teamId), eq(appointments.estado, "solicitada")))
      .orderBy(asc(appointments.createdAt)),
    db.select().from(memberships).where(eq(memberships.teamId, teamId)),
    db.select({ id: services.id }).from(services).where(eq(services.tenantId, teamId)),
    db.select({ id: patients.id }).from(patients).where(eq(patients.tenantId, teamId)),
    db
      .select({
        id: payments.id,
        monto: payments.monto,
        metodo: payments.metodo,
        patientNombre: patients.nombre,
        referencia: payments.referencia,
        estado: payments.estado,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(patients, eq(payments.patientId, patients.id))
      .where(eq(payments.tenantId, teamId))
      .orderBy(desc(payments.createdAt)),
    Promise.resolve(null),
  ]);

  void solicitadas;
  const todayStart = new Date(`${today}T00:00:00`);
  const pagosHoy = paymentsAll.filter((p) => {
    if (p.estado === "anulado" || p.estado === "por_conciliar") return false;
    const t = p.createdAt ? new Date(p.createdAt) : null;
    return !t || t >= todayStart;
  });
  const ingresosHoy = pagosHoy.reduce((acc, p) => acc + Number(p.monto), 0);
  const atendidasHoy = apptsToday.filter((a) => a.estado === "atendida").length;
  const confirmadasHoy = apptsToday.filter(
    (a) => a.estado === "confirmada" || a.estado === "en_espera" || a.estado === "en_atencion",
  ).length;

  return {
    today,
    solicitudesPendientes: pendientes.length,
    pendientes,
    miembros: members.length,
    serviciosCount: servicesCount.length,
    pacientesCount: patientsCount.length,
    ingresosHoy,
    pagosHoy,
    atendidasHoy,
    confirmadasHoy,
    citasHoy: apptsToday.length,
  };
}

export async function staffList(teamId: string) {
  const db = getDb();
  return db
    .select({
      membershipId: memberships.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      active: memberships.active,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.teamId, teamId))
    .orderBy(asc(users.name));
}

export async function pacientesBasicos(teamId: string) {
  const db = getDb();
  return db
    .select({ id: patients.id, nombre: patients.nombre })
    .from(patients)
    .where(eq(patients.tenantId, teamId))
    .orderBy(asc(patients.nombre));
}

export async function pacientesConStats(teamId: string) {
  const db = getDb();
  return db
    .select({
      id: patients.id,
      nombre: patients.nombre,
      celular: patients.celular,
      celular2: patients.email,
      createdAt: patients.createdAt,
      totalVisitas: sql<number>`count(${appointments.id})`.mapWith(Number),
      ultimaVisita: sql<string>`max(${appointments.fecha})`,
    })
    .from(patients)
    .leftJoin(appointments, eq(patients.id, appointments.patientId))
    .where(eq(patients.tenantId, teamId))
    .groupBy(patients.id, patients.nombre, patients.celular, patients.email, patients.createdAt)
    .orderBy(desc(sql`max(${appointments.fecha})`));
}

export async function doctoresConColor(teamId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: memberships.id,
      name: users.name,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(memberships.teamId, teamId), eq(memberships.role, "doctor"), eq(memberships.active, true)))
    .orderBy(asc(users.name));
  const colors = ["#0d9488", "#0284c7", "#7c3aed", "#d97706", "#db2777", "#059669"];
  return rows.map((r, i) => ({ ...r, color: colors[i % colors.length] }));
}

export async function doctorSchedule(teamId: string, fecha: string) {
  const db = getDb();
  return db
    .select({
      id: appointments.id,
      horaIni: appointments.horaIni,
      horaFin: appointments.horaFin,
      estado: appointments.estado,
      patientNombre: patients.nombre,
      serviceNombre: services.nombre,
      doctorMembershipId: appointments.doctorId,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .where(and(eq(appointments.tenantId, teamId), eq(appointments.fecha, fecha)))
    .orderBy(asc(appointments.horaIni));
}

export async function ingresosDiarios(teamId: string, dias = 14) {
  const rows = await cajaHoy(teamId);
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" });
  const porDia = new Map<string, number>();
  const hoy = new Date();
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoy.getTime() - i * 86_400_000);
    porDia.set(fmt.format(d), 0);
  }
  for (const p of rows) {
    if (p.estado === "anulado" || p.estado === "por_conciliar") continue;
    const k = p.createdAt ? fmt.format(new Date(p.createdAt)) : null;
    if (k && porDia.has(k)) porDia.set(k, (porDia.get(k) ?? 0) + Number(p.monto));
  }
  const corto = new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Lima",
  });
  return Array.from(porDia, ([fecha, total]) => ({
    fecha,
    label: corto.format(new Date(`${fecha}T12:00:00`)),
    total,
  }));
}

export async function topServicios(teamId: string, limite = 5) {
  const db = getDb();
  const rows = await db
    .select({
      servicio: services.nombre,
      total: sql<number>`sum(${appointments.monto})`.mapWith(Number),
      citas: sql<number>`count(${appointments.id})`.mapWith(Number),
    })
    .from(appointments)
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .where(
      and(
        eq(appointments.tenantId, teamId),
        eq(appointments.estado, "atendida"),
      ),
    )
    .groupBy(services.nombre)
    .orderBy(desc(sql`sum(${appointments.monto})`))
    .limit(limite);
  return rows;
}

export async function membershipIdPorNombre(teamId: string, name: string) {
  const db = getDb();
  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(memberships.teamId, teamId), eq(users.name, name)))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function citasDelDia(teamId: string, fecha: string) {
  const db = getDb();
  return db
    .select({
      id: appointments.id,
      horaIni: appointments.horaIni,
      horaFin: appointments.horaFin,
      estado: appointments.estado,
      triageNivel: appointments.triageNivel,
      triajeAt: appointments.triajeAt,
      patientNombre: patients.nombre,
      servicio: services.nombre,
      servicioPrecio: services.precio,
      doctorId: appointments.doctorId,
      doctorNombre: users.name,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(memberships, eq(appointments.doctorId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(appointments.tenantId, teamId), eq(appointments.fecha, fecha)))
    .orderBy(asc(appointments.horaIni));
}

export async function solicitudesActivas(teamId: string) {
  const db = getDb();
  return db
    .select({
      id: appointments.id,
      fecha: appointments.fecha,
      horaIni: appointments.horaIni,
      horaFin: appointments.horaFin,
      estado: appointments.estado,
      notas: appointments.notas,
      monto: appointments.monto,
      patientNombre: patients.nombre,
      patientCelular: patients.celular,
      servicio: services.nombre,
      servicioDuracion: services.duracionMin,
      preferredDoctorId: appointments.preferredDoctorId,
      preferredDoctorNombre: users.name,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(memberships, eq(appointments.preferredDoctorId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(appointments.tenantId, teamId), eq(appointments.estado, "solicitada")))
    .orderBy(asc(appointments.createdAt));
}

export async function cajaHoy(teamId: string) {
  const db = getDb();
  return db
    .select({
      id: payments.id,
      monto: payments.monto,
      metodo: payments.metodo,
      referencia: payments.referencia,
      estado: payments.estado,
      patientNombre: patients.nombre,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .leftJoin(patients, eq(payments.patientId, patients.id))
    .where(eq(payments.tenantId, teamId))
    .orderBy(desc(payments.createdAt));
}

export async function citasEnRango(teamId: string, desde: string, hasta: string) {
  const db = getDb();
  return db
    .select({
      id: appointments.id,
      fecha: appointments.fecha,
      horaIni: appointments.horaIni,
      horaFin: appointments.horaFin,
      estado: appointments.estado,
      monto: appointments.monto,
      patientNombre: patients.nombre,
      servicio: services.nombre,
      doctorId: appointments.doctorId,
      doctorNombre: users.name,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(memberships, eq(appointments.doctorId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(
      and(
        eq(appointments.tenantId, teamId),
        gte(appointments.fecha, desde),
        lte(appointments.fecha, hasta),
      ),
    )
    .orderBy(asc(appointments.fecha), asc(appointments.horaIni));
}

export async function adjuntosDePaciente(teamId: string, patientId: string) {
  const db = getDb();
  return db
    .select({
      id: attachments.id,
      tipo: attachments.tipo,
      nombre: attachments.nombre,
      mime: attachments.mime,
      sizeBytes: attachments.sizeBytes,
      nota: attachments.nota,
      createdAt: attachments.createdAt,
    })
    .from(attachments)
    .where(and(eq(attachments.tenantId, teamId), eq(attachments.patientId, patientId)))
    .orderBy(desc(attachments.createdAt));
}

export async function consentimientosDePaciente(teamId: string, patientId: string) {
  const db = getDb();
  return db
    .select({
      id: signedConsents.id,
      servicioNombre: signedConsents.servicioNombre,
      signedBy: signedConsents.signedBy,
      createdAt: signedConsents.createdAt,
    })
    .from(signedConsents)
    .where(and(eq(signedConsents.tenantId, teamId), eq(signedConsents.patientId, patientId)))
    .orderBy(desc(signedConsents.createdAt));
}

export async function bloqueosDia(teamId: string, fecha: string) {
  const db = getDb();
  return db
    .select({
      id: blockedSlots.id,
      horaIni: blockedSlots.horaIni,
      horaFin: blockedSlots.horaFin,
      motivo: blockedSlots.motivo,
      doctorId: blockedSlots.doctorId,
    })
    .from(blockedSlots)
    .where(and(eq(blockedSlots.tenantId, teamId), eq(blockedSlots.fecha, fecha)))
    .orderBy(asc(blockedSlots.horaIni));
}

export async function turnosPorMiembro(teamId: string) {
  const db = getDb();
  return db
    .select({
      membershipId: staffSchedules.membershipId,
      dayOfWeek: staffSchedules.dayOfWeek,
      horaIni: staffSchedules.horaIni,
      horaFin: staffSchedules.horaFin,
    })
    .from(staffSchedules)
    .innerJoin(memberships, eq(staffSchedules.membershipId, memberships.id))
    .where(eq(memberships.teamId, teamId))
    .orderBy(asc(staffSchedules.membershipId), asc(staffSchedules.dayOfWeek));
}

export async function ingresosPorMetodo(teamId: string, desde: string) {
  const db = getDb();
  const rows = await db
    .select({
      metodo: payments.metodo,
      total: sql<string>`sum(${payments.monto})`,
      cantidad: sql<number>`count(${payments.id})`.mapWith(Number),
    })
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, teamId),
        eq(payments.estado, "valido"),
        gte(payments.createdAt, new Date(`${desde}T00:00:00`)),
      ),
    )
    .groupBy(payments.metodo)
    .orderBy(desc(sql`sum(${payments.monto})`));
  return rows.map((r) => ({ ...r, total: Number(r.total ?? 0) }));
}

export async function statsRango(teamId: string, desde: string, hasta: string) {
  const db = getDb();
  const rows = await db
    .select({
      estado: appointments.estado,
      total: sql<number>`count(${appointments.id})`.mapWith(Number),
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, teamId),
        gte(appointments.fecha, desde),
        lte(appointments.fecha, hasta),
      ),
    )
    .groupBy(appointments.estado);
  const porEstado = new Map(rows.map((r) => [r.estado, r.total]));
  const noShows = porEstado.get("no_show") ?? 0;
  const atendidas = porEstado.get("atendida") ?? 0;
  const ocupables = atendidas + noShows;
  const ocupacion = ocupables > 0 ? Math.round((atendidas / ocupables) * 100) : 0;
  const total = rows.reduce((acc, r) => acc + r.total, 0);
  return { noShows, atendidas, ocupacion, total };
}

export async function cierreDelDia(teamId: string, fecha: string) {
  const db = getDb();
  const cierres = await db
    .select()
    .from(cashClosures)
    .where(and(eq(cashClosures.tenantId, teamId), eq(cashClosures.fecha, fecha)))
    .orderBy(desc(cashClosures.createdAt));
  const cerrado = cierres.find((c) => c.estado === "cerrado");
  return cerrado ?? cierres[0] ?? null;
}

export async function cierresDeCaja(teamId: string) {
  const db = getDb();
  return db
    .select({
      id: cashClosures.id,
      fecha: cashClosures.fecha,
      apertura: cashClosures.apertura,
      cierreReal: cashClosures.cierreReal,
      cierreSistema: cashClosures.cierreSistema,
      diferencia: cashClosures.diferencia,
      estado: cashClosures.estado,
      cerradoPorNombre: users.name,
      createdAt: cashClosures.createdAt,
    })
    .from(cashClosures)
    .leftJoin(users, eq(cashClosures.cerradoPor, users.id))
    .where(eq(cashClosures.tenantId, teamId))
    .orderBy(desc(cashClosures.fecha));
}

export async function fichaPaciente(teamId: string, patientId: string) {
  const db = getDb();
  const [paciente] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.tenantId, teamId)))
    .limit(1);
  if (!paciente) return null;
  const citas = await db
    .select({
      id: appointments.id,
      fecha: appointments.fecha,
      horaIni: appointments.horaIni,
      estado: appointments.estado,
      monto: appointments.monto,
      montoPagado: appointments.montoPagado,
      servicio: services.nombre,
      doctorNombre: users.name,
    })
    .from(appointments)
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(memberships, eq(appointments.doctorId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(eq(appointments.patientId, patientId))
    .orderBy(desc(appointments.fecha));
  const pagos = await db
    .select({
      id: payments.id,
      monto: payments.monto,
      metodo: payments.metodo,
      referencia: payments.referencia,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(eq(payments.patientId, patientId))
    .orderBy(desc(payments.createdAt));
  return { paciente, citas, pagos };
}

export async function panelAdmin() {
  const db = getDb();
  const tenants = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      createdAt: teams.createdAt,
      plan: subscriptions.plan,
      estado: subscriptions.estado,
      vence: subscriptions.vence,
      monto: subscriptions.monto,
      nota: subscriptions.nota,
    })
    .from(teams)
    .leftJoin(subscriptions, eq(subscriptions.tenantId, teams.id))
    .orderBy(asc(teams.createdAt));
  const porTenant = new Map<string, { miembros: number; pacientes: number }>();
  for (const t of tenants) porTenant.set(t.id, { miembros: 0, pacientes: 0 });
  const membersRows = await db
    .select({ teamId: memberships.teamId, total: sql<number>`count(${memberships.id})`.mapWith(Number) })
    .from(memberships)
    .where(eq(memberships.active, true))
    .groupBy(memberships.teamId);
  for (const r of membersRows) {
    const c = porTenant.get(r.teamId);
    if (c) c.miembros = r.total;
  }
  const patientsRows = await db
    .select({ teamId: patients.tenantId, total: sql<number>`count(${patients.id})`.mapWith(Number) })
    .from(patients)
    .groupBy(patients.tenantId);
  for (const r of patientsRows) {
    const c = porTenant.get(r.teamId);
    if (c) c.pacientes = r.total;
  }
  const [today] = [new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date())];
  const citasHoy = await db
    .select({ teamId: appointments.tenantId, total: sql<number>`count(${appointments.id})`.mapWith(Number) })
    .from(appointments)
    .where(eq(appointments.fecha, today))
    .groupBy(appointments.tenantId);
  const citasPorTenant = new Map(citasHoy.map((r) => [r.teamId, r.total]));
  return {
    today,
    tenants: tenants.map((t) => ({
      ...t,
      miembros: porTenant.get(t.id)?.miembros ?? 0,
      pacientes: porTenant.get(t.id)?.pacientes ?? 0,
      citasHoy: citasPorTenant.get(t.id) ?? 0,
    })),
  };
}

export async function auditList(teamId: string, limite = 100) {
  const db = getDb();
  return db
    .select({
      id: auditLogs.id,
      accion: auditLogs.accion,
      entidad: auditLogs.entidad,
      entidadId: auditLogs.entidadId,
      payload: auditLogs.payload,
      createdAt: auditLogs.createdAt,
      userName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(eq(auditLogs.tenantId, teamId))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(limite);
}

export async function comprobantesConPago(teamId: string) {
  const db = getDb();
  return db
    .select({
      id: receipts.id,
      tipo: receipts.tipo,
      serie: receipts.serie,
      correlativo: receipts.correlativo,
      estado: receipts.estado,
      createdAt: receipts.createdAt,
      monto: payments.monto,
      metodo: payments.metodo,
      patientNombre: patients.nombre,
    })
    .from(receipts)
    .innerJoin(payments, eq(receipts.paymentId, payments.id))
    .leftJoin(patients, eq(payments.patientId, patients.id))
    .where(eq(receipts.tenantId, teamId))
    .orderBy(desc(receipts.createdAt));
}

export async function pagosSinComprobante(teamId: string) {
  const db = getDb();
  const todos = await db
    .select({
      id: payments.id,
      monto: payments.monto,
      metodo: payments.metodo,
      referencia: payments.referencia,
      createdAt: payments.createdAt,
      patientNombre: patients.nombre,
    })
    .from(payments)
    .leftJoin(patients, eq(payments.patientId, patients.id))
    .where(eq(payments.tenantId, teamId))
    .orderBy(desc(payments.createdAt))
    .limit(200);
  const conComprobante = new Set(
    (
      await db
        .select({ paymentId: receipts.paymentId })
        .from(receipts)
        .where(eq(receipts.tenantId, teamId))
    ).map((r) => r.paymentId),
  );
  return todos.filter((p) => !conComprobante.has(p.id));
}

export async function registrosPaciente(patientId: string) {
  const db = getDb();
  return db
    .select({
      id: clinicalRecords.id,
      nota: clinicalRecords.nota,
      createdAt: clinicalRecords.createdAt,
      authorNombre: users.name,
    })
    .from(clinicalRecords)
    .leftJoin(users, eq(clinicalRecords.createdBy, users.id))
    .where(eq(clinicalRecords.patientId, patientId))
    .orderBy(desc(clinicalRecords.createdAt));
}

export async function pacientesDormidos(teamId: string) {
  const db = getDb();
  const hoy = new Date();
  const rows = await db
    .select({
      id: patients.id,
      nombre: patients.nombre,
      celular: patients.celular,
      pacienteCreado: patients.createdAt,
      ultimaVisita: sql<string>`max(${appointments.fecha})`,
    })
    .from(patients)
    .leftJoin(appointments, eq(patients.id, appointments.patientId))
    .where(eq(patients.tenantId, teamId))
    .groupBy(patients.id, patients.nombre, patients.celular, patients.createdAt)
    .orderBy(asc(sql`max(${appointments.fecha})`));
  return rows.map((r) => {
    const base = r.ultimaVisita
      ? new Date(`${r.ultimaVisita}T00:00:00`)
      : r.pacienteCreado
        ? new Date(r.pacienteCreado)
        : hoy;
    const meses = Math.max(0, Math.floor((hoy.getTime() - base.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
    return {
      id: r.id,
      nombre: r.nombre,
      celular: r.celular,
      ultimaVisita: r.ultimaVisita,
      mesesSinVisita: meses,
      estado: meses >= 6 ? "dormido" : meses >= 4 ? "en_riesgo" : "activo",
    } as const;
  });
}

export async function ultimoCorrelativo(
  teamId: string,
  tipo: "boleta" | "factura" | "nota_credito" | "nota_debito",
  serie: string,
) {
  const db = getDb();
  const [row] = await db
    .select({ maximo: sql<number>`max(${receipts.correlativo})`.mapWith(Number) })
    .from(receipts)
    .where(and(eq(receipts.tenantId, teamId), eq(receipts.tipo, tipo), eq(receipts.serie, serie)));
  return row?.maximo ?? null;
}

export interface PrimerPaso {
  id: string;
  titulo: string;
  detail: string;
  href: string;
  hecho: boolean;
}

export async function primerosPasos(teamId: string): Promise<PrimerPaso[]> {
  const db = getDb();
  const [legal, servicios, equipo, invitaciones, pacientesCount, citaConfirmada] =
    await Promise.all([
      db
        .select({ razonSocial: legalSettings.razonSocial })
        .from(legalSettings)
        .where(eq(legalSettings.tenantId, teamId))
        .limit(1)
        .then((r) => r[0] ?? null),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(services)
        .where(eq(services.tenantId, teamId))
        .then((r) => r[0]?.n ?? 0),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(memberships)
        .where(eq(memberships.teamId, teamId))
        .then((r) => r[0]?.n ?? 0),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(invitations)
        .where(
          and(
            eq(invitations.teamId, teamId),
            gte(invitations.expiresAt, new Date()),
          ),
        )
        .then((r) => r[0]?.n ?? 0),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(patients)
        .where(eq(patients.tenantId, teamId))
        .then((r) => r[0]?.n ?? 0),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(appointments)
        .where(
          and(
            eq(appointments.tenantId, teamId),
            eq(appointments.estado, "confirmada"),
          ),
        )
        .limit(1)
        .then((r) => r[0]?.n ?? 0),
    ]);

  return [
    {
      id: "legal",
      titulo: "Configura los datos de tu clínica",
      detail: "Razón social, RUC y textos legales de tu página pública.",
      href: "/consola/config/legal",
      hecho: Boolean(legal?.razonSocial),
    },
    {
      id: "servicios",
      titulo: "Crea tus servicios y precios",
      detail: "El catálogo que verán tus pacientes al reservar.",
      href: "/consola/config/servicios",
      hecho: servicios > 0,
    },
    {
      id: "equipo",
      titulo: "Invita a tu equipo",
      detail: "Recepción, asistente u odontólogo, cada uno con su rol.",
      href: "/consola/personal",
      hecho: equipo > 1 || invitaciones > 0,
    },
    {
      id: "reservas",
      titulo: "Comparte tu página de reservas",
      detail: "Envía el enlace público: tus pacientes reservan sin cuenta.",
      href: "/consola/soporte",
      hecho: pacientesCount > 0,
    },
    {
      id: "primera-cita",
      titulo: "Confirma tu primera cita",
      detail: "Revisa la cola de solicitudes y confirma en un clic.",
      href: "/consola/solicitudes",
      hecho: citaConfirmada > 0,
    },
  ];
}

// ---------------------------------------------------------------------------
// Producción por doctor (OLA 6)
// ---------------------------------------------------------------------------

export async function produccionPorDoctor(
  teamId: string,
  desde: string,
  hasta: string,
) {
  const db = getDb();
  const filas = await db
    .select({
      doctorId: appointments.doctorId,
      doctorNombre: users.name,
      atendidas: sql<number>`count(distinct ${appointments.id}) filter (where ${appointments.estado} = 'atendida')`.mapWith(Number),
      noShows: sql<number>`count(distinct ${appointments.id}) filter (where ${appointments.estado} = 'no_show')`.mapWith(Number),
      totalCitas: sql<number>`count(distinct ${appointments.id})`.mapWith(Number),
      ventas: sql<number>`coalesce(sum(${payments.monto}::numeric), 0)`.mapWith(Number),
      pagos: sql<number>`count(distinct ${payments.id})`.mapWith(Number),
    })
    .from(appointments)
    .leftJoin(memberships, eq(appointments.doctorId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .leftJoin(payments, eq(payments.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.tenantId, teamId),
        gte(appointments.fecha, desde),
        lte(appointments.fecha, hasta),
      ),
    )
    .groupBy(appointments.doctorId, users.name)
    .orderBy(desc(sql`coalesce(sum(${payments.monto}::numeric), 0)`));
  return filas.map((f) => ({
    ...f,
    doctorNombre: f.doctorNombre ?? "Sin doctor asignado",
    ticket: f.pagos > 0 ? Math.round((f.ventas / f.pagos) * 100) / 100 : 0,
  }));
}

export async function produccionDoctorDetalle(
  teamId: string,
  doctorId: string,
  desde: string,
  hasta: string,
) {
  const db = getDb();
  const citas = await db
    .select({
      id: appointments.id,
      fecha: appointments.fecha,
      horaIni: appointments.horaIni,
      estado: appointments.estado,
      monto: appointments.monto,
      servicio: services.nombre,
      paciente: patients.nombre,
    })
    .from(appointments)
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(patients, eq(appointments.patientId, patients.id))
    .where(
      and(
        eq(appointments.tenantId, teamId),
        eq(appointments.doctorId, doctorId),
        gte(appointments.fecha, desde),
        lte(appointments.fecha, hasta),
      ),
    )
    .orderBy(desc(appointments.fecha), desc(appointments.horaIni))
    .limit(200);
  const pagos = await db
    .select({
      id: payments.id,
      monto: payments.monto,
      metodo: payments.metodo,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.tenantId, teamId),
        eq(appointments.doctorId, doctorId),
        gte(appointments.fecha, desde),
        lte(appointments.fecha, hasta),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(200);
  return { citas, pagos };
}
