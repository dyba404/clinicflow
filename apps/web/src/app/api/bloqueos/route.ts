import { NextResponse } from "next/server";
import { and, eq, gt, lt } from "drizzle-orm";
import { hasPermission } from "@clinicflow/core";
import { getDb, blockedSlots, appointments, memberships } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export async function POST(req: Request) {
  const full = await guardStaff("agenda.view_all");
  let g: typeof full;
  let soloPropio = false;
  if (full.ok) {
    g = full;
  } else {
    const own = await guardStaff("agenda.view_own");
    if (!own.ok) {
      return NextResponse.json({ error: guardError(own) }, { status: own.status });
    }
    g = own;
    soloPropio = true;
  }

  let body: { fecha?: string; horaIni?: string; horaFin?: string; motivo?: string; doctorId?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const fecha = body.fecha ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
  }
  const horaIni = body.horaIni ?? "";
  const horaFin = body.horaFin ?? "";
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(horaIni) || !/^\d{2}:\d{2}(:\d{2})?$/.test(horaFin)) {
    return NextResponse.json({ error: "hora_invalida" }, { status: 400 });
  }
  const ini = horaIni.length === 5 ? `${horaIni}:00` : horaIni;
  const fin = horaFin.length === 5 ? `${horaFin}:00` : horaFin;
  if (ini >= fin) {
    return NextResponse.json({ error: "rango_invalido" }, { status: 400 });
  }

  const doctorId: string | null = soloPropio ? g.membership.id : body.doctorId ?? null;
  const db = getDb();
  if (doctorId) {
    const [memb] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.id, doctorId),
          eq(memberships.teamId, g.team.id),
          eq(memberships.active, true),
        ),
      )
      .limit(1);
    if (!memb) {
      return NextResponse.json({ error: "doctor_invalido" }, { status: 400 });
    }
  }

  const [conflicto] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, g.team.id),
        eq(appointments.fecha, fecha),
        doctorId ? eq(appointments.doctorId, doctorId) : undefined,
        lt(appointments.horaIni, fin),
        gt(appointments.horaFin, ini),
      ),
    )
    .limit(1);
  if (conflicto) {
    return NextResponse.json({ error: "hay_citas_en_el_rango" }, { status: 409 });
  }

  const [row] = await db
    .insert(blockedSlots)
    .values({
      tenantId: g.team.id,
      doctorId,
      fecha,
      horaIni: ini,
      horaFin: fin,
      motivo: body.motivo?.trim() || null,
    })
    .returning({ id: blockedSlots.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "bloqueo.crear",
    entidad: "blocked_slots",
    entidadId: row!.id,
    payload: { fecha, horaIni: ini, horaFin: fin },
  });

  return NextResponse.json({ ok: true, id: row!.id }, { status: 201 });
}

export async function DELETE(req: Request) {
  const g = await guardStaff();
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const puedeTodos = hasPermission(g.membership.role, "agenda.view_all");

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id_requerido" }, { status: 400 });
  }

  const db = getDb();
  if (!puedeTodos) {
    const [row] = await db
      .select({ id: blockedSlots.id, doctorId: blockedSlots.doctorId })
      .from(blockedSlots)
      .where(and(eq(blockedSlots.id, id), eq(blockedSlots.tenantId, g.team.id)))
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
    }
    if (row.doctorId !== g.membership.id) {
      return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
    }
    await db
      .delete(blockedSlots)
      .where(and(eq(blockedSlots.id, id), eq(blockedSlots.tenantId, g.team.id)));
  } else {
    const rows = await db
      .delete(blockedSlots)
      .where(and(eq(blockedSlots.id, id), eq(blockedSlots.tenantId, g.team.id)))
      .returning({ id: blockedSlots.id });
    if (rows.length === 0) {
      return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
    }
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "bloqueo.eliminar",
    entidad: "blocked_slots",
    entidadId: id,
  });

  return NextResponse.json({ ok: true });
}
