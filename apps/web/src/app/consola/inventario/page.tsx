import { redirect } from "next/navigation";
import { Boxes, Package, AlertTriangle, CalendarClock, FlaskConical } from "lucide-react";
import { hasPermission } from "@clinicflow/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { getSession } from "@/lib/auth";
import { getDefaultTeam } from "@/lib/console-data";
import { gatePlan } from "@/lib/plans";
import { PlanGate } from "@/components/console/plan-gate";
import { alertasInventario } from "@/lib/inventario";
import { getDb, services, serviceMaterials, inventoryItems, stockMovements } from "@clinicflow/db";
import { and, eq } from "drizzle-orm";
import { fmtPEN, fmtFechaRelativa } from "@/lib/format";
import { ItemDialog } from "./item-dialog";
import { MovimientoDialog } from "./movimiento-dialog";
import { RecetaDialog } from "./receta-dialog";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  ingreso: "Ingreso",
  consumo: "Consumo",
  ajuste: "Ajuste",
  merma: "Merma",
};

const TIPO_VARIANT: Record<string, "green" | "amber" | "gray" | "red"> = {
  ingreso: "green",
  consumo: "gray",
  ajuste: "amber",
  merma: "red",
};

export default async function InventarioPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const team = await getDefaultTeam();
  if (!team) redirect("/login");

  if (!hasPermission(session.role, "inventory.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Inventario" description="Stock de materiales, lotes y kardex." />
        <Card>
          <EmptyState
            icon={Boxes}
            title="Acceso restringido"
            description="Solo el dueño y las asistentes pueden gestionar el inventario."
          />
        </Card>
      </div>
    );
  }

  const planCheck = await gatePlan(team.id, "inventario");
  if (!planCheck.ok) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Inventario" description="Stock de materiales, lotes y kardex." />
        <PlanGate feature="inventario" requerido={planCheck.requerido} />
      </div>
    );
  }

  const db = getDb();
  const items = await db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.tenantId, team.id), eq(inventoryItems.activo, true)));

  const servicios = await db
    .select({ id: services.id, nombre: services.nombre, precio: services.precio })
    .from(services)
    .where(and(eq(services.tenantId, team.id), eq(services.activo, true)));

  const recetas = await db
    .select({ serviceId: serviceMaterials.serviceId, itemId: serviceMaterials.itemId })
    .from(serviceMaterials);
  const conReceta = new Set(recetas.filter((r) => servicios.some((s) => s.id === r.serviceId)).map((r) => r.serviceId));

  const [alertas, movimientos] = await Promise.all([
    alertasInventario(team.id),
    db
      .select({
        id: stockMovements.id,
        itemId: stockMovements.itemId,
        tipo: stockMovements.tipo,
        cantidad: stockMovements.cantidad,
        nota: stockMovements.nota,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .where(eq(stockMovements.tenantId, team.id)),
  ]);
  const nombreItem = new Map(items.map((i) => [i.id, i.nombre]));
  const kardex = movimientos
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 50);

  const valorStock = items.reduce((acc, i) => acc + Number(i.stock) * Number(i.costoUnit), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Inventario"
        description={`${items.length} artículos activos · valor de stock ${fmtPEN(valorStock)}.`}
        action={
          <ItemDialog
            modo="crear"
            item={null}
            triggerLabel="Nuevo artículo"
          />
        }
      />

      {(alertas.bajos.length > 0 || alertas.lotesPorVencer.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {alertas.bajos.length > 0 && (
            <Card className="border-amber-300/60">
              <CardContent className="space-y-2 p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="size-4 text-amber-600" />
                  Stock bajo ({alertas.bajos.length})
                </p>
                <p className="text-xs text-muted-foreground">
                  {alertas.bajos.slice(0, 4).map((i) => i.nombre).join(", ")}
                  {alertas.bajos.length > 4 ? ` y ${alertas.bajos.length - 4} más` : ""}
                </p>
              </CardContent>
            </Card>
          )}
          {alertas.lotesPorVencer.length > 0 && (
            <Card className="border-amber-300/60">
              <CardContent className="space-y-2 p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <CalendarClock className="size-4 text-amber-600" />
                  Lotes por vencer (30 días)
                </p>
                <p className="text-xs text-muted-foreground">
                  {alertas.lotesPorVencer
                    .slice(0, 3)
                    .map((l) => `${l.itemNombre} (${l.lote})`)
                    .join(", ")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm font-medium">Artículos</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {items.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Sin artículos"
                description="Crea artículos de inventario para controlar el stock de materiales."
              />
            ) : (
              <div className="divide-y">
                {items.map((i) => {
                  const bajo = Number(i.stock) <= Number(i.stockMin);
                  return (
                    <div key={i.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          {i.nombre}
                          <Badge variant="gray">{i.categoria}</Badge>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Costo {fmtPEN(Number(i.costoUnit))} · mínimo {Number(i.stockMin)} {i.unidad}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-sm font-semibold tabular-nums ${bajo ? "text-amber-600" : ""}`}>
                          {Number(i.stock)} {i.unidad}
                        </p>
                        {bajo && <Badge variant="amber">Bajo</Badge>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <MovimientoDialog itemId={i.id} nombre={i.nombre} />
                        <ItemDialog modo="editar" item={i} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="p-5 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <FlaskConical className="size-4 text-primary" />
                Recetas por servicio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-5 pt-0">
              {servicios.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Sin servicios.</p>
              ) : (
                servicios.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm">{s.nombre}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      {conReceta.has(s.id) ? (
                        <Badge variant="teal">Con receta</Badge>
                      ) : (
                        <Badge variant="gray">Sin receta</Badge>
                      )}
                      <RecetaDialog servicioId={s.id} nombre={s.nombre} />
                    </div>
                  </div>
                ))
              )}
              <p className="pt-2 text-xs text-muted-foreground">
                Al atender una cita se descuenta automáticamente la receta de su servicio.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-medium">Kardex reciente</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {kardex.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Sin movimientos.</p>
              ) : (
                <ul className="space-y-2">
                  {kardex.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <Badge variant={TIPO_VARIANT[m.tipo] ?? "gray"}>
                          {TIPO_LABEL[m.tipo] ?? m.tipo}
                        </Badge>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {nombreItem.get(m.itemId) ?? "—"} {m.nota ? ` · ${m.nota}` : ""}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {Number(m.cantidad) > 0 ? "+" : ""}
                        {Number(m.cantidad)} · {fmtFechaRelativa(m.createdAt.toISOString())}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
