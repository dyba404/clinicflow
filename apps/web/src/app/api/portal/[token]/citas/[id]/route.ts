import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, appointments, services } from "@clinicflow/db";
import { resolvePortalAccess } from "@/lib/portal-access";
import { computeSlots } from "@/lib/db";
import { rateLimit, ipReq } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { hoyTenant } from "@/lib/auth";
import { ofrecerHuecoAutomatico } from "@/lib/hueco";
import { horaFinDesde, horarioOcupado, normalizarHora } from "../../../../citas/solape";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;

  const limite = rateLimit(`portal:citas:${token}:${id}:${ipReq(req)}`, 12);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  const r = await resolvePortalAccess(token);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 404 });
  const { ctx } = r;

  let body: { accion?: string; fecha?: string; horaIni?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (!body.accion) {
    return NextResponse.json({ error: "accion_requerida" }, { status: 400 });
  }

  const db = getDb();

  if (body.accion === "cancelar") {
    const [cita] = await db
      .select({ id: appointments.id, estado: appointments.estado })
      .from(appointments)
      .where(
        and(
          eq(appointments.id, id),
          eq(appointments.tenantId, ctx.team.id),
          eq(appointments.patientId, ctx.patient.id),
        ),
      )
      .limit(1);

    if (!cita) {
      return NextResponse.json({ error: "cita_no_encontrada" }, { status: 404 });
    }
    if (cita.estado !== "solicitada" && cita.estado !== "confirmada") {
      return NextResponse.json({ error: `no_se_puede_cancelar_en_${cita.estado}` }, { status: 409 });
    }

    const eraConfirmada = cita.estado === "confirmada";
    await db
      .update(appointments)
      .set({ estado: "cancelada", updatedAt: new Date() })
      .where(eq(appointments.id, cita.id));

    void logAudit({
      tenantId: ctx.team.id,
      accion: "cita.cancelar_paciente",
      entidad: "citas",
      entidadId: cita.id,
      payload: { via: "portal_paciente" },
    });

    if (eraConfirmada) {
      const [datos] = await db
        .select({ fecha: appointments.fecha, horaIni: appointments.horaIni })
        .from(appointments)
        .where(eq(appointments.id, cita.id));
      if (datos) {
        void ofrecerHuecoAutomatico({
          tenantId: ctx.team.id,
          tenantNombre: ctx.team.name,
          tenantSlug: ctx.team.slug,
          citaId: cita.id,
          fecha: datos.fecha,
          horaIni: datos.horaIni,
          via: "portal_paciente",
        }).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, accion: "cancelada" });
  }

  if (body.accion === "reprogramar") {
    const [cita] = await db
      .select({
        id: appointments.id,
        estado: appointments.estado,
        serviceId: appointments.serviceId,
        doctorId: appointments.doctorId,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.id, id),
          eq(appointments.tenantId, ctx.team.id),
          eq(appointments.patientId, ctx.patient.id),
        ),
      )
      .limit(1);

    if (!cita) {
      return NextResponse.json({ error: "cita_no_encontrada" }, { status: 404 });
    }
    if (cita.estado !== "solicitada" && cita.estado !== "confirmada") {
      return NextResponse.json({ error: `no_se_puede_reprogramar_en_${cita.estado}` }, { status: 409 });
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
      .where(and(eq(services.id, cita.serviceId), eq(services.tenantId, ctx.team.id)))
      .limit(1);
    if (!service) {
      return NextResponse.json({ error: "servicio_invalido" }, { status: 400 });
    }
    const horaFin = horaFinDesde(horaIni, service.duracionMin);
    if (!horaFin) {
      return NextResponse.json({ error: "hora_invalida" }, { status: 400 });
    }

    if (cita.doctorId) {
      const ocupado = await horarioOcupado({
        tenantId: ctx.team.id,
        fecha,
        horaIni,
        horaFin,
        doctorId: cita.doctorId,
        excluirCitaId: cita.id,
      });
      if (ocupado) {
        return NextResponse.json({ error: "horario_ocupado" }, { status: 409 });
      }
    } else {
      const nuevosSlots = await computeSlots(ctx.team.id, {
        serviceId: cita.serviceId,
        date: fecha,
        excluirCitaId: cita.id,
      });
      const slotExiste = (nuevosSlots?.slots ?? []).some((s) => normalizarHora(s.startTime) === horaIni);
      if (!slotExiste) {
        return NextResponse.json({ error: "horario_ocupado" }, { status: 409 });
      }
    }

    let updated;
    try {
      [updated] = await db
        .update(appointments)
        .set({ fecha, horaIni, horaFin, updatedAt: new Date() })
        .where(eq(appointments.id, cita.id))
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
      entidadId: cita.id,
      payload: { via: "portal_paciente", fecha, horaIni },
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
