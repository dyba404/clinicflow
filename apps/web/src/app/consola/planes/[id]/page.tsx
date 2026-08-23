import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  getDb,
  patients,
  treatmentPlans,
  treatmentPlanItems,
  treatmentPlanSessions,
  memberships,
  users,
} from "@clinicflow/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@clinicflow/core";
import { fmtPEN } from "@/lib/format";
import { AccionesPlan, AccionesItem } from "./acciones-plan";

export const dynamic = "force-dynamic";

const ESTADO_LABEL: Record<string, string> = {
  draft: "Borrador",
  pending: "Pendiente",
  active: "Activo",
  completed: "Completado",
  archived: "Archivado",
  closed: "Cerrado",
};

const ITEM_LABEL: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  done: "Completado",
  cancelled: "Cancelado",
};

export default async function PlanDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const db = getDb();
  const [row] = await db
    .select()
    .from(treatmentPlans)
    .leftJoin(patients, eq(treatmentPlans.patientId, patients.id))
    .leftJoin(memberships, eq(treatmentPlans.assignedDoctorId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(treatmentPlans.id, id), eq(treatmentPlans.tenantId, session.teamId)))
    .limit(1);
  if (!row) notFound();

  const plan = row.treatment_plans;
  const paciente = row.patients;
  const canEdit = hasPermission(session.role, "quotes.manage");

  const items = await db
    .select()
    .from(treatmentPlanItems)
    .where(and(eq(treatmentPlanItems.planId, id), eq(treatmentPlanItems.tenantId, session.teamId)))
    .orderBy(asc(treatmentPlanItems.secuencia));

  const sesiones =
    items.length > 0
      ? await db
          .select()
          .from(treatmentPlanSessions)
          .where(
            and(
              eq(treatmentPlanSessions.tenantId, session.teamId),
              inArray(treatmentPlanSessions.itemId, items.map((i) => i.id)),
            ),
          )
          .orderBy(asc(treatmentPlanSessions.sessionN))
      : [];
  const sesionesPorItem = new Map<string, typeof sesiones>();
  for (const s of sesiones) {
    const arr = sesionesPorItem.get(s.itemId) ?? [];
    arr.push(s);
    sesionesPorItem.set(s.itemId, arr);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={`${plan.planNumber} · ${plan.titulo}`}
        description={`${paciente?.nombre ?? "Paciente"} · ${row.users?.name ?? "sin doctor asignado"}${plan.closureReason ? ` · cerrado: ${plan.closureReason}` : ""}`}
        action={
          canEdit ? (
            <AccionesPlan planId={plan.id} estado={plan.estado} canDelete={plan.estado === "draft"} />
          ) : null
        }
      />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-4">
          <CardTitle className="text-sm font-medium">Ítems del plan</CardTitle>
          <Badge>{ESTADO_LABEL[plan.estado] ?? plan.estado}</Badge>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin ítems todavía.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {items.map((item) => {
                const snap = item.snapshotServicio as { nombre?: string; precio?: string | number };
                const ses = sesionesPorItem.get(item.id) ?? [];
                return (
                  <li key={item.id} className="space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {item.secuencia}. {snap?.nombre ?? "Servicio"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fmtPEN(Number(snap?.precio ?? 0))}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{ITEM_LABEL[item.estado] ?? item.estado}</Badge>
                        {canEdit ? (
                          <AccionesItem planId={plan.id} itemId={item.id} estado={item.estado} />
                        ) : null}
                      </div>
                    </div>
                    {ses.length > 0 ? (
                      <ul className="space-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs">
                        {ses.map((s) => (
                          <li key={s.id} className="flex items-center justify-between">
                            <span>
                              Sesión {s.sessionN} · {s.estado}
                              {s.realizadaAt
                                ? ` (${new Date(s.realizadaAt).toLocaleDateString("es-PE")})`
                                : ""}
                            </span>
                            {s.notas ? <span className="text-muted-foreground">{s.notas}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href="/consola/planes"
            className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Volver a planes
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
