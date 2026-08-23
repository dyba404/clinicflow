import { redirect } from "next/navigation";
import { FileSignature } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { getDb, consentTemplates } from "@clinicflow/db";
import { hasPermission } from "@clinicflow/core";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { getSession } from "@/lib/auth";
import { TemplatesManager, type TemplateConsentimiento } from "./templates-manager";

export const dynamic = "force-dynamic";

export default async function ConsentimientosPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "records.edit")) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Consentimientos"
          description="Plantillas de consentimiento informado para firmar antes de cada tratamiento."
        />
        <Card>
          <EmptyState
            icon={FileSignature}
            title="Acceso restringido"
            description="Solo doctores y dueños pueden gestionar plantillas."
          />
        </Card>
      </div>
    );
  }

  const templates = (await getDb()
    .select()
    .from(consentTemplates)
    .where(eq(consentTemplates.tenantId, session.teamId))
    .orderBy(desc(consentTemplates.activo), desc(consentTemplates.createdAt))) as TemplateConsentimiento[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Consentimientos"
        description="Plantillas de consentimiento informado. Fírmalas desde la ficha del paciente."
      />
      <Card>
        <div className="p-5">
          <TemplatesManager templates={templates} />
        </div>
      </Card>
    </div>
  );
}
