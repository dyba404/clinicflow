import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import {
  getDb,
  appointments,
  consultations,
  dispensations,
  inventoryItems,
  inventoryLots,
  patients,
  stockMovements,
} from "@clinicflow/db";
import { guardStaff, guardError, hoyTenant } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guardStaff("inventory.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "inventario");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: {
    patientId?: string;
    appointmentId?: string;
    consultationId?: string;
    itemId?: string;
    cantidad?: number | string;
    lotId?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (!body.itemId) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }
  const cantidad = Number(body.cantidad);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return NextResponse.json({ error: "cantidad_invalida" }, { status: 400 });
  }

  const db = getDb();
  const [item] = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, body.itemId),
        eq(inventoryItems.tenantId, g.team.id),
        eq(inventoryItems.activo, true),
      ),
    )
    .limit(1);
  if (!item) {
    return NextResponse.json({ error: "item_no_encontrado" }, { status: 404 });
  }

  let paciente: { id: string; nombre: string } | null = null;
  if (body.patientId) {
    const [p] = await db
      .select({ id: patients.id, nombre: patients.nombre })
      .from(patients)
      .where(and(eq(patients.id, body.patientId), eq(patients.tenantId, g.team.id)))
      .limit(1);
    if (!p) {
      return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
    }
    paciente = p;
  }

  if (body.appointmentId) {
    const [c] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.id, body.appointmentId), eq(appointments.tenantId, g.team.id)))
      .limit(1);
    if (!c) {
      return NextResponse.json({ error: "cita_no_encontrada" }, { status: 404 });
    }
  }
  if (body.consultationId) {
    const [c] = await db
      .select({ id: consultations.id })
      .from(consultations)
      .where(
        and(eq(consultations.id, body.consultationId), eq(consultations.tenantId, g.team.id)),
      )
      .limit(1);
    if (!c) {
      return NextResponse.json({ error: "consulta_no_encontrada" }, { status: 404 });
    }
  }

  const hoy = await hoyTenant(g.team.timezone);

  const lotes = await db
    .select()
    .from(inventoryLots)
    .where(and(eq(inventoryLots.itemId, item.id), sql`${inventoryLots.cantidad} > 0`))
    .orderBy(sql`${inventoryLots.vence} ASC NULLS LAST`);
  const vigentes = lotes.filter((l) => !l.vence || l.vence >= hoy);

  let seleccion: Array<{ id: string; cantidad: string; usar: number }>;
  if (body.lotId) {
    const lote = vigentes.find((l) => l.id === body.lotId);
    if (!lote) {
      return NextResponse.json({ error: "stock_insuficiente_o_vencido" }, { status: 409 });
    }
    if (Number(lote.cantidad) < cantidad) {
      return NextResponse.json({ error: "stock_insuficiente_o_vencido" }, { status: 409 });
    }
    seleccion = [{ id: lote.id, cantidad: lote.cantidad, usar: cantidad }];
  } else {
    seleccion = [];
    let restante = cantidad;
    for (const lote of vigentes) {
      if (restante <= 0) break;
      const usar = Math.min(Number(lote.cantidad), restante);
      if (usar <= 0) continue;
      seleccion.push({ id: lote.id, cantidad: lote.cantidad, usar });
      restante -= usar;
    }
    if (restante > 0) {
      return NextResponse.json({ error: "stock_insuficiente_o_vencido" }, { status: 409 });
    }
  }

  const nuevoStock = Number(item.stock) - cantidad;
  if (nuevoStock < 0) {
    return NextResponse.json({ error: "stock_insuficiente_o_vencido" }, { status: 409 });
  }

  for (const s of seleccion) {
    await db
      .update(inventoryLots)
      .set({ cantidad: (Number(s.cantidad) - s.usar).toFixed(2) })
      .where(eq(inventoryLots.id, s.id));
  }
  await db
    .update(inventoryItems)
    .set({ stock: nuevoStock.toFixed(2) })
    .where(eq(inventoryItems.id, item.id));

  const nota = paciente ? `Dispensa a ${paciente.nombre}` : "Dispensa de farmacia";
  const [mov] = await db
    .insert(stockMovements)
    .values({
      tenantId: g.team.id,
      itemId: item.id,
      tipo: "consumo",
      cantidad: (-cantidad).toFixed(2),
      appointmentId: body.appointmentId ?? null,
      nota,
      createdBy: g.user.id,
    })
    .returning({ id: stockMovements.id });

  const [disp] = await db
    .insert(dispensations)
    .values({
      tenantId: g.team.id,
      patientId: paciente?.id ?? null,
      itemId: item.id,
      lotId: seleccion[0]!.id,
      cantidad: cantidad.toFixed(2),
      dispensadoPor: g.user.id,
    })
    .returning({ id: dispensations.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "farmacia.dispensar",
    entidad: "dispensations",
    entidadId: disp!.id,
    payload: {
      itemId: item.id,
      cantidad,
      lotes: seleccion.map((s) => s.id),
      patientId: paciente?.id ?? null,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      id: disp!.id,
      itemId: item.id,
      lotId: seleccion[0]!.id,
      cantidad,
      stock: nuevoStock.toFixed(2),
      movimientoId: mov!.id,
    },
    { status: 201 },
  );
}
