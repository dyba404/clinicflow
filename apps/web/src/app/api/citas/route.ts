import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, appointments, patients, services, memberships, users } from "@clinicflow/db";
import { guardStaff, guardError, hoyTenant } from "@/lib/auth";
import { computeSlots } from "@/lib/db";
import { logAuditSesion } from "@/lib/audit";
import { sucursalActiva } from "@/lib/branch";
import { horaFinDesde, horarioOcupado, normalizarHora } from "./solape";

export async function POST(req: Request) {
  const g = await guardStaff("appointments.create");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    serviceId?: string;
    doctorId?: string | null;
    fecha?: string;
    horaIni?: string;
    paciente?: { id?: string } | { nombre?: string; celular?: string };
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const db = getDb();
  const { serviceId, fecha, horaIni: horaIniRaw, paciente } = body;
  const doctorId = body.doctorId ?? null;

  if (!serviceId || !fecha || !horaIniRaw || !paciente) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
  }

  const hoy = await hoyTenant(g.team.timezone);
  if (fecha < hoy) {
    return NextResponse.json({ error: "fecha_pasada" }, { status: 400 });
  }

  const horaIni = normalizarHora(horaIniRaw);
  if (!horaIni) {
    return NextResponse.json({ error: "hora_invalida" }, { status: 400 });
  }

  const [service] = await db
    .select()
    .from(services)
    .where(
      and(eq(services.id, serviceId), eq(services.tenantId, g.team.id), eq(services.activo, true)),
    )
    .limit(1);
  if (!service) {
    return NextResponse.json({ error: "servicio_invalido" }, { status: 400 });
  }

  const horaFin = horaFinDesde(horaIni, service.duracionMin);
  if (!horaFin) {
    return NextResponse.json({ error: "hora_invalida" }, { status: 400 });
  }

  let patient;
  if ("id" in paciente && paciente.id) {
    const [p] = await db
      .select()
      .from(patients)
      .where(and(eq(patients.id, paciente.id), eq(patients.tenantId, g.team.id)))
      .limit(1);
    patient = p;
    if (!patient) {
      return NextResponse.json({ error: "paciente_invalido" }, { status: 404 });
    }
  } else if ("nombre" in paciente && paciente.nombre && paciente.celular) {
    const nombre = paciente.nombre.trim();
    const telNorm = paciente.celular.replace(/\s+/g, "");
    if (nombre.length < 3) {
      return NextResponse.json({ error: "nombre_invalido" }, { status: 400 });
    }
    if (!/^\+?[0-9]{7,15}$/.test(telNorm)) {
      return NextResponse.json({ error: "celular_invalido" }, { status: 400 });
    }
    const existentes = await db
      .select()
      .from(patients)
      .where(and(eq(patients.tenantId, g.team.id), eq(patients.celular, telNorm)))
      .limit(1);
    patient = existentes[0];
    if (!patient) {
      const creados = await db
        .insert(patients)
        .values({
          tenantId: g.team.id,
          nombre,
          celular: telNorm,
          createdBy: g.user.id,
        })
        .returning();
      patient = creados[0];
    }
  } else {
    return NextResponse.json({ error: "paciente_invalido" }, { status: 400 });
  }
  if (!patient) {
    return NextResponse.json({ error: "paciente_invalido" }, { status: 500 });
  }

  let doctorMembershipId: string | null = doctorId;
  if (g.membership.role === "doctor") {
    doctorMembershipId = g.membership.id;
  } else if (doctorMembershipId) {
    const [membDoc] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.id, doctorMembershipId),
          eq(memberships.teamId, g.team.id),
          eq(memberships.role, "doctor"),
          eq(memberships.active, true),
        ),
      )
      .limit(1);
    if (!membDoc) {
      return NextResponse.json({ error: "doctor_invalido" }, { status: 400 });
    }
  }

  if (doctorMembershipId) {
    const ocupado = await horarioOcupado({
      tenantId: g.team.id,
      fecha,
      horaIni,
      horaFin,
      doctorId: doctorMembershipId,
    });
    if (ocupado) {
      return NextResponse.json({ error: "horario_ocupado" }, { status: 409 });
    }
  } else {
    // Cita sin doctor: el "bucket sin asignar" ocupa la franja. La lista de
    // horarios del diálogo ya la descuenta; aquí se valida de nuevo contra el
    // estado real (lista stale, doble envío). Nota: queda una ventana de
    // carrera entre este check y el INSERT (sin constraint en BD para citas
    // sin doctor); la lista de la UI y este check la hacen poco probable.
    const nuevosSlots = await computeSlots(g.team.id, {
      serviceId: service.id,
      date: fecha,
      doctorMembershipId: null,
    });
    const libre =
      nuevosSlots?.slots.some((s) => normalizarHora(s.startTime) === horaIni) ?? false;
    if (!libre) {
      return NextResponse.json({ error: "horario_ocupado" }, { status: 409 });
    }
  }

  let appt;
  const branchId = await sucursalActiva(g.team.id);
  try {
    [appt] = await db
      .insert(appointments)
      .values({
        tenantId: g.team.id,
        branchId,
        serviceId: service.id,
        patientId: patient.id,
        doctorId: doctorMembershipId,
        preferredDoctorId: doctorMembershipId,
        fecha,
        horaIni,
        horaFin,
        estado: "confirmada",
        modoSolicitud: false,
        monto: service.precio,
        createdBy: g.user.id,
      })
      .returning();
  } catch (e) {
    if (e instanceof Error && /appointments_no_overlap/i.test(e.message)) {
      return NextResponse.json({ error: "horario_ocupado" }, { status: 409 });
    }
    throw e;
  }
  if (!appt) {
    return NextResponse.json({ error: "no_se_pudo_crear" }, { status: 500 });
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "cita.crear",
    entidad: "citas",
    entidadId: appt.id,
    payload: { estado: appt.estado },
  });

  return NextResponse.json({ ok: true, id: appt.id }, { status: 201 });
}
