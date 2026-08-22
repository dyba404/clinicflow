import { redirect } from "next/navigation";
import { GraduationCap, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { getSession } from "@/lib/auth";
import { getDefaultTeam } from "@/lib/console-data";
import { guiasParaRol } from "@/lib/guias";
import { GuiaSecciones } from "@/components/console/guia-secciones";

export const dynamic = "force-dynamic";

const ROL_ETIQUETA: Record<string, string> = {
  owner: "Dueño/a",
  receptionist: "Recepción",
  assistant: "Asistente",
  doctor: "Odontólogo/a",
};

export default async function GuiaConsolaPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  const secciones = guiasParaRol(session.role);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Guía de Clinicflow"
        description="Guías paso a paso para tu equipo, según los permisos de tu rol."
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <GraduationCap className="size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            Estás viendo las guías de <strong>{ROL_ETIQUETA[session.role] ?? session.role}</strong>.
            Comparte el enlace público con tu equipo para que lean todas las guías sin iniciar sesión.
          </p>
          <Badge>{ROL_ETIQUETA[session.role] ?? session.role}</Badge>
          <a
            href={`/${team.slug}/guia`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Versión pública <ExternalLink className="size-3.5" />
          </a>
        </CardContent>
      </Card>

      <GuiaSecciones secciones={secciones} />
    </div>
  );
}
