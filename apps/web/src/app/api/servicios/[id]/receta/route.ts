import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, services, serviceMaterials, inventoryItems } from "@clinicflow/db";
import { desc } from "drizzle-orm";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("inventory.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "inventario");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const db = getDb();
  const [servicio] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, id), eq(services.tenantId, g.team.id)))
    .limit(1);
  if (!servicio) return NextResponse.json({ error: "servicio_no_encontrado" }, { status: 404 });

  const materiales = await db
    .select({
      id: serviceMaterials.id,
      itemId: serviceMaterials.itemId,
      cantidad: serviceMaterials.cantidad,
      nombre: inventoryItems.nombre,
      unidad: inventoryItems.unidad,
      costoUnit: inventoryItems.costoUnit,
    })
    .from(serviceMaterials)
    .innerJoin(inventoryItems, eq(serviceMaterials.itemId, inventoryItems.id))
    .where(eq(serviceMaterials.serviceId, servicio.id))
    .orderBy(desc(inventoryItems.nombre));

  return NextResponse.json({
    servicio: { id: servicio.id, nombre: servicio.nombre, precio: servicio.precio },
    materiales,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("inventory.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "inventario");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: { materiales?: Array<{ itemId?: string; cantidad?: number | string }> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (!Array.isArray(body.materiales)) {
    return NextResponse.json({ error: "materiales_requeridos" }, { status: 400 });
  }

  const db = getDb();
  const [servicio] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, id), eq(services.tenantId, g.team.id)))
    .limit(1);
  if (!servicio) return NextResponse.json({ error: "servicio_no_encontrado" }, { status: 404 });

  const validos: Array<{ itemId: string; cantidad: number }> = [];
  for (const m of body.materiales) {
    const cantidad = Number(m.cantidad);
    if (!m.itemId || !Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 10000) {
      return NextResponse.json({ error: "material_invalido" }, { status: 400 });
    }
    const [item] = await db
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, m.itemId), eq(inventoryItems.tenantId, g.team.id), eq(inventoryItems.activo, true)))
      .limit(1);
    if (!item) return NextResponse.json({ error: "material_no_encontrado" }, { status: 400 });
    validos.push({ itemId: item.id, cantidad });
  }

  await db.delete(serviceMaterials).where(eq(serviceMaterials.serviceId, servicio.id));
  if (validos.length > 0) {
    await db.insert(serviceMaterials).values(
      validos.map((v) => ({
        serviceId: servicio.id,
        itemId: v.itemId,
        cantidad: v.cantidad.toFixed(2),
      })),
    );
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "inventario.receta_guardar",
    entidad: "service_materials",
    entidadId: servicio.id,
    payload: { servicio: servicio.nombre, materiales: validos.length },
  });

  return NextResponse.json({ ok: true });
}
