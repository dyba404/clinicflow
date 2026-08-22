import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, appointments, services } from "@clinicflow/db";
import { resolveMagicToken } from "@/lib/magic-link";
import { computeSlots } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hoyTenant } from "@/lib/auth";
import { ofrecerHuecoAutomatico } from "@/lib/hueco";
import { horaFinDesde, horarioOcupado, normalizarHora } from "../../citas/solape";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveMagicToken(token);
  if (!r.ok) {
    return NextResponse.json({ error: r.reason }, { status: 404 });
  }
  const { ctx } = r;
  return NextResponse.json({
    clinica: { nombre: ctx.team.name, slug: ctx.team.slug },
    paciente: { nombre: ctx.patient.nombre },
    cita: {
      id: ctx.appointment.id,
      fecha: ctx.appointment.fecha,
      horaIni: ctx.appointment.horaIni,
      horaFin: ctx.appointment.horaFin,
      estado: ctx.appointment.estado,
      servicio: ctx.service?.nombre ?? null,
    },
    serviceId: ctx.appointment.serviceId,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveMagicToken(token);
  if (!r.ok) {
    return NextResponse.json({ error: r.reason }, { status: 404 });
  }
  const { ctx } = r;

  let body: { accion?: string; fecha?: string; horaIni?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const db = getDb();

  if (body.accion === "cancelar") {
    if (ctx.appointment.estado !== "solicitada" && ctx.appointment.estado !== "confirmada") {
      return NextResponse.json(
        { error: `no_se_puede_cancelar_en_${ctx.appointment.estado}` },
        { status: 409 },
      );
    }
    const eraConfirmada = ctx.appointment.estado === "confirmada";
    await db
      .update(appointments)
      .set({ estado: "cancelada", updatedAt: new Date() })
      .where(eq(appointments.id, ctx.appointment.id));

    void logAudit({
      tenantId: ctx.team.id,
      accion: "cita.cancelar_paciente",
      entidad: "citas",
      entidadId: ctx.appointment.id,
      payload: { via: "link_magico" },
    });

    if (eraConfirmada) {
      void ofrecerHuecoAutomatico({
        tenantId: ctx.team.id,
        tenantNombre: ctx.team.name,
        tenantSlug: ctx.team.slug,
        citaId: ctx.appointment.id,
        fecha: ctx.appointment.fecha,
        horaIni: ctx.appointment.horaIni,
        via: "link_magico",
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, accion: "cancelada" });
  }

  if (body.accion === "reprogramar") {
    if (ctx.appointment.estado !== "solicitada" && ctx.appointment.estado !== "confirmada") {
      return NextResponse.json(
        { error: `no_se_puede_reprogramar_en_${ctx.appointment.estado}` },
        { status: 409 },
      );
    }
    const fecha = body.fecha ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
    }
    const hoy = await hoyTenant(ctx.team.timezone);
    if (fecha < hoy) {
      return NextResponse.json({ error: "fecha_pasada" }, { status: 400 });
    }
    const horaIni = normalizarHora(body.horaIni ?? "");
    if (!horaIni) {
      return NextResponse.json({ error: "hora_invalida" }, { status: 400 });
    }

    const [service] = await db
      .select()
      .from(services)
      .where(and(eq(services.id, ctx.appointment.serviceId), eq(services.tenantId, ctx.team.id)))
      .limit(1);
    if (!service) {
      return NextResponse.json({ error: "servicio_invalido" }, { status: 400 });
    }
    const horaFin = horaFinDesde(horaIni, service.duracionMin);
    if (!horaFin) {
      return NextResponse.json({ error: "hora_invalida" }, { status: 400 });
    }

    const doctorId = ctx.appointment.doctorId;
    if (doctorId) {
      const ocupado = await horarioOcupado({
        tenantId: ctx.team.id,
        fecha,
        horaIni,
        horaFin,
        doctorId,
        excluirCitaId: ctx.appointment.id,
      });
      if (ocupado) {
        return NextResponse.json({ error: "horario_ocupado" }, { status: 409 });
      }
    }

    const nuevosSlots = await computeSlots(ctx.team.id, {
      serviceId: ctx.appointment.serviceId,
      date: fecha,
      doctorMembershipId: doctorId ?? null,
      excluirCitaId: ctx.appointment.id,
    });
    const libre =
      (doctorId
        ? true
        : nuevosSlots?.slots.some((s) => normalizarHora(s.startTime) === horaIni)) ?? false;
    if (!doctorId && !libre) {
      return NextResponse.json({ error: "horario_ocupado" }, { status: 409 });
    }

    let updated;
    try {
      [updated] = await db
        .update(appointments)
        .set({ fecha, horaIni, horaFin, updatedAt: new Date() })
        .where(eq(appointments.id, ctx.appointment.id))
        .returning();
    } catch (e) {
      if (e instanceof Error && /appointments_no_overlap/i.test(e.message)) {
        return NextResponse.json({ error: "horario_ocupado" }, { status: 409 });
      }
      throw e;
    }
    if (!updated) {
      return NextResponse.json({ error: "no_se_pudo_actualizar" }, { status: 500 });
    }

    void logAudit({
      tenantId: ctx.team.id,
      accion: "cita.reprogramar_paciente",
      entidad: "citas",
      entidadId: ctx.appointment.id,
      payload: { via: "link_magico", fecha, horaIni },
    });

    return NextResponse.json({
      ok: true,
      accion: "reprogramada",
      fecha: updated.fecha,
      horaIni: updated.horaIni,
      horaFin: updated.horaFin,
    });
  }

  return NextResponse.json({ error: "accion_desconocida" }, { status: 400 });
}
