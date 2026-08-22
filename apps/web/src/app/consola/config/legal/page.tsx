import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { hasPermission } from "@clinicflow/core";
import { getDb, legalSettings } from "@clinicflow/db";
import { Lock, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { getSession } from "@/lib/auth";
import { getDefaultTeam } from "@/lib/console-data";
import { LegalForm, type LegalInicial } from "./legal-form";

export const dynamic = "force-dynamic";

export default async function LegalConfigPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "services.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Cumplimiento legal" description="Textos legales de tu plataforma." />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo el rol Dueño/a puede editar la configuración legal."
          />
        </Card>
      </div>
    );
  }

  const [legal] = await getDb()
    .select()
    .from(legalSettings)
    .where(eq(legalSettings.tenantId, team.id))
    .limit(1);

  const inicial: LegalInicial = {
    razonSocial: legal?.razonSocial ?? null,
    ruc: legal?.ruc ?? null,
    direccionLegal: legal?.direccionLegal ?? null,
    emailContactoDatos: legal?.emailContactoDatos ?? null,
    telefonoContactoDatos: legal?.telefonoContactoDatos ?? null,
    politicaPrivacidad: legal?.politicaPrivacidad ?? null,
    terminosUso: legal?.terminosUso ?? null,
    textoConsentimiento: legal?.textoConsentimiento ?? null,
  };

  const configurado = Boolean(legal?.razonSocial && legal?.emailContactoDatos);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Cumplimiento legal"
        description="Datos del responsable y textos de privacidad/términos publicados en tu página pública de reservas (Ley 29733)."
      />

      <div className="flex items-center gap-2">
        <Scale className="size-4 text-muted-foreground" />
        {configurado ? (
          <>
            <Badge variant="green">Datos legales completos</Badge>
            <span className="text-xs text-muted-foreground">
              Publicado en /{team.slug}/privacidad y /{team.slug}/terminos.
            </span>
          </>
        ) : (
          <>
            <Badge variant="amber">Pendiente completar</Badge>
            <span className="text-xs text-muted-foreground">
              Mientras no completes tus datos, se publican plantillas con el nombre de la clínica.
            </span>
          </>
        )}
      </div>

      <LegalForm inicial={inicial} slug={team.slug} />
    </div>
  );
}
