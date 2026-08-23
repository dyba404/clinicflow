import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { getDb, patients, treatmentPlans, memberships, users } from "@clinicflow/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ESTADO_LABEL: Record<string, string> = {
  draft: "Borrador",
  pending: "Pendiente",
  active: "Activo",
  completed: "Completado",
  archived: "Archivado",
  closed: "Cerrado",
};

export default async function PlanesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rows = await getDb()
    .select({
      id: treatmentPlans.id,
      planNumber: treatmentPlans.planNumber,
      titulo: treatmentPlans.titulo,
      estado: treatmentPlans.estado,
      patientNombre: patients.nombre,
      doctorNombre: users.name,
      createdAt: treatmentPlans.createdAt,
    })
    .from(treatmentPlans)
    .leftJoin(patients, eq(treatmentPlans.patientId, patients.id))
    .leftJoin(memberships, eq(treatmentPlans.assignedDoctorId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(eq(treatmentPlans.tenantId, session.teamId))
    .orderBy(desc(treatmentPlans.createdAt))
    .limit(100);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Planes de tratamiento"
        description="Pipeline de tratamiento por paciente: borrador, pendiente, activo, completado o cerrado."
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Sin planes de tratamiento"
            description="Crea el primer plan desde la ficha de un paciente."
          />
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/consola/planes/${r.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {r.planNumber} · {r.titulo}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.patientNombre ?? "Paciente"} · {r.doctorNombre ?? "sin doctor"} ·{" "}
                      {r.createdAt.toLocaleDateString("es-PE")}
                    </p>
                  </div>
                  <Badge>{ESTADO_LABEL[r.estado] ?? r.estado}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
