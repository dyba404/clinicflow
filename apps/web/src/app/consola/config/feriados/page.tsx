import { redirect } from "next/navigation";
import { CalendarOff, Lock } from "lucide-react";
import { hasPermission } from "@clinicflow/core";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/console/empty-state";
import { PageHeader } from "@/components/console/page-header";
import { FeriadosForm } from "./feriados-form";
import { getDefaultTeam } from "@/lib/console-data";
import { getSession } from "@/lib/auth";
import { getDb, holidays } from "@clinicflow/db";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function FeriadosPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "services.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Feriados"
          description="Fechas en las que la clínica no ofrece horarios."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo el rol Dueño/a puede editar esta configuración."
          />
        </Card>
      </div>
    );
  }

  const rows = await getDb()
    .select({
      id: holidays.id,
      fecha: holidays.fecha,
      nombre: holidays.nombre,
    })
    .from(holidays)
    .where(eq(holidays.tenantId, team.id))
    .orderBy(asc(holidays.fecha));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Feriados"
        description="En estas fechas la página pública no muestra horarios disponibles."
      />

      <Card>
        <CardContent className="p-5">
          <FeriadosForm
            feriados={rows.map((r) => ({ id: r.id, fecha: r.fecha, nombre: r.nombre }))}
          />
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarOff}
            title="Sin feriados registrados"
            description="Agrega los feriados del año para bloquear la agenda en esas fechas."
          />
        </Card>
      ) : null}
    </div>
  );
}
