import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Lock } from "lucide-react";
import { hasPermission } from "@clinicflow/core";
import { desc, eq } from "drizzle-orm";
import { getDb, orders, patients } from "@clinicflow/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { getSession } from "@/lib/auth";
import { OrdenesCola } from "./ordenes-cola";

export const dynamic = "force-dynamic";

export default async function OrdenesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "labs.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Órdenes"
          description="Cola de órdenes de laboratorio e imagen."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo el dueño, las asistentes y los odontólogos pueden gestionar órdenes."
          />
        </Card>
      </div>
    );
  }

  const db = getDb();
  const rows = await db
    .select({
      id: orders.id,
      patientId: orders.patientId,
      nombrePaciente: patients.nombre,
      appointmentId: orders.appointmentId,
      tipo: orders.tipo,
      nombre: orders.nombre,
      indicacion: orders.indicacion,
      estado: orders.estado,
      prioridad: orders.prioridad,
      resultado: orders.resultado,
      motivoRevision: orders.motivoRevision,
      rev: orders.rev,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(patients, eq(orders.patientId, patients.id))
    .where(eq(orders.tenantId, session.teamId))
    .orderBy(desc(orders.prioridad), desc(orders.createdAt));

  const iniciales = rows.map((r) => ({
    ...r,
    resultado: r.resultado,
    createdAt: format(r.createdAt, "d MMM yyyy", { locale: es }),
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Órdenes"
        description="Cola de trabajo de laboratorio e imagen: avanza el estado hasta liberar y entregar."
      />
      <Card>
        <OrdenesCola ordenes={iniciales} />
      </Card>
    </div>
  );
}
