import { and, eq, isNull, or, sql } from "drizzle-orm";
import {
  getDb,
  appointments,
  services,
  serviceMaterials,
  inventoryItems,
  inventoryLots,
  stockMovements,
} from "@clinicflow/db";

export type ResultadoConsumo = {
  consumido: boolean;
  faltantes: string[];
};

export async function consumirMateriales(
  tenantId: string,
  appointmentId: string,
): Promise<ResultadoConsumo> {
  const db = getDb();
  const [cita] = await db
    .select({ id: appointments.id, serviceId: appointments.serviceId })
    .from(appointments)
    .where(and(eq(appointments.id, appointmentId), eq(appointments.tenantId, tenantId)))
    .limit(1);
  if (!cita) return { consumido: false, faltantes: [] };

  const receta = await db
    .select({
      itemId: serviceMaterials.itemId,
      cantidad: serviceMaterials.cantidad,
      nombre: inventoryItems.nombre,
      stock: inventoryItems.stock,
    })
    .from(serviceMaterials)
    .innerJoin(inventoryItems, eq(serviceMaterials.itemId, inventoryItems.id))
    .where(and(eq(serviceMaterials.serviceId, cita.serviceId), eq(inventoryItems.activo, true)));

  if (receta.length === 0) return { consumido: false, faltantes: [] };

  const faltantes: string[] = [];
  for (const item of receta) {
    const necesario = Number(item.cantidad);
    const disponible = Number(item.stock);
    if (disponible < necesario) {
      faltantes.push(item.nombre);
      continue;
    }

    const lots = await db
      .select({ id: inventoryLots.id, cantidad: inventoryLots.cantidad, vence: inventoryLots.vence })
      .from(inventoryLots)
      .where(and(eq(inventoryLots.itemId, item.itemId), sql`${inventoryLots.cantidad} > 0`))
      .orderBy(sql`${inventoryLots.vence} ASC NULLS LAST`);

    let restante = necesario;
    for (const lote of lots) {
      if (restante <= 0) break;
      const usar = Math.min(Number(lote.cantidad), restante);
      const nuevaCantidad = Number(lote.cantidad) - usar;
      await db
        .update(inventoryLots)
        .set({ cantidad: nuevaCantidad.toFixed(2) })
        .where(eq(inventoryLots.id, lote.id));
      restante -= usar;
    }

    await db
      .update(inventoryItems)
      .set({ stock: (disponible - necesario).toFixed(2) })
      .where(eq(inventoryItems.id, item.itemId));

    await db.insert(stockMovements).values({
      tenantId,
      itemId: item.itemId,
      tipo: "consumo",
      cantidad: (-necesario).toFixed(2),
      appointmentId,
    });
  }

  return { consumido: true, faltantes };
}

export async function alertasInventario(teamId: string) {
  const db = getDb();
  const items = await db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.tenantId, teamId), eq(inventoryItems.activo, true)));

  const bajos = items.filter((i) => Number(i.stock) <= Number(i.stockMin));

  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  const dias30 = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(
    new Date(Date.now() + 30 * 86_400_000),
  );
  const lotesPorVencer = await db
    .select({
      id: inventoryLots.id,
      lote: inventoryLots.lote,
      vence: inventoryLots.vence,
      cantidad: inventoryLots.cantidad,
      itemNombre: inventoryItems.nombre,
      itemId: inventoryItems.id,
    })
    .from(inventoryLots)
    .innerJoin(inventoryItems, eq(inventoryLots.itemId, inventoryItems.id))
    .where(
      and(
        eq(inventoryItems.tenantId, teamId),
        or(
          and(sql`${inventoryLots.vence} <= ${dias30}`, sql`${inventoryLots.vence} >= ${hoy}`),
          isNull(inventoryLots.vence),
        ),
      ),
    );
  const conFecha = lotesPorVencer.filter((l) => l.vence !== null);

  return { bajos, lotesPorVencer: conFecha };
}

export async function margenesPorServicio(teamId: string) {
  const db = getDb();
  const servicios = await db
    .select({
      id: services.id,
      nombre: services.nombre,
      precio: services.precio,
      activo: services.activo,
    })
    .from(services)
    .where(and(eq(services.tenantId, teamId), eq(services.activo, true)));

  const recetas = await db
    .select({
      serviceId: serviceMaterials.serviceId,
      costo: sql<string>`sum(${serviceMaterials.cantidad} * ${inventoryItems.costoUnit})`,
    })
    .from(serviceMaterials)
    .innerJoin(inventoryItems, eq(serviceMaterials.itemId, inventoryItems.id))
    .where(eq(inventoryItems.tenantId, teamId))
    .groupBy(serviceMaterials.serviceId);

  const costoPorServicio = new Map(recetas.map((r) => [r.serviceId, Number(r.costo ?? 0)]));
  return servicios.map((s) => {
    const precio = Number(s.precio);
    const costo = costoPorServicio.get(s.id) ?? 0;
    const margen = precio - costo;
    const pct = precio > 0 ? Math.round((margen / precio) * 100) : 0;
    return { id: s.id, nombre: s.nombre, precio, costo, margen, pct };
  });
}
