import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { hasPermission } from "@clinicflow/core";
import { asc, count, eq } from "drizzle-orm";
import { getDb, insurers, patientCoverages } from "@clinicflow/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/console/empty-state";
import { PageHeader } from "@/components/console/page-header";
import { AseguradoraDialog } from "./aseguradora-dialog";
import { AseguradoraCardActions } from "./aseguradora-card-actions";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AseguradorasPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = getDb();
  const rows = await db
    .select({
      id: insurers.id,
      nombre: insurers.nombre,
      ruc: insurers.ruc,
      telefono: insurers.telefono,
      activo: insurers.activo,
    })
    .from(insurers)
    .where(eq(insurers.tenantId, session.teamId))
    .orderBy(asc(insurers.nombre));

  const conteos = await db
    .select({
      insurerId: patientCoverages.insurerId,
      total: count(patientCoverages.id),
    })
    .from(patientCoverages)
    .innerJoin(insurers, eq(patientCoverages.insurerId, insurers.id))
    .where(eq(insurers.tenantId, session.teamId))
    .groupBy(patientCoverages.insurerId);
  const porAseguradora = new Map(conteos.map((c) => [c.insurerId, c.total]));

  const puedeGestionar = hasPermission(session.role, "insurers.manage");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Aseguradoras y EPS"
        description="Entidades que cubren tratamientos de tus pacientes."
        action={puedeGestionar ? <AseguradoraDialog /> : undefined}
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Sin aseguradoras registradas"
            description="Crea tu primera aseguradora o EPS para vincular coberturas a pacientes."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((a) => {
            const afiliados = porAseguradora.get(a.id) ?? 0;
            return (
              <Card
                key={a.id}
                className={
                  a.activo ? "transition-colors duration-200 hover:bg-surface-hover" : "opacity-60"
                }
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">
                        {a.ruc ? `RUC ${a.ruc}` : "Sin RUC"}
                      </p>
                    </div>
                    <Badge variant={a.activo ? "green" : "gray"}>
                      {a.activo ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {a.telefono ?? "Sin teléfono"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {afiliados} {afiliados === 1 ? "cobertura vinculada" : "coberturas vinculadas"}
                  </p>

                  {puedeGestionar ? (
                    <div className="mt-4 flex justify-end border-t border-border-subtle pt-3">
                      <AseguradoraCardActions aseguradora={a} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
