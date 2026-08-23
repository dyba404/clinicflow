import { redirect } from "next/navigation";
import { hasPermission } from "@clinicflow/core";
import { Bell, Check, Mail, MessageSquare, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { NotificacionesForm } from "./notificaciones-form";
import { getDefaultTeam } from "@/lib/console-data";
import { getSession } from "@/lib/auth";
import { mailConfigurado, mailEstadoHumano } from "@/lib/mail";
import { getNotificationSettings } from "@/lib/reminder-engine";
import { Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NotificacionesConfigPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "services.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Notificaciones" description="Configuración de avisos a pacientes." />
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

  const settings = await getNotificationSettings(team.id);
  const emailOperativo = mailConfigurado();
  const estadoEmail = mailEstadoHumano();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Notificaciones"
        description="Activa o desactiva los avisos automáticos que reciben los pacientes."
      />

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <Mail className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Canal de email</p>
            <p className="text-xs text-muted-foreground">
              {emailOperativo
                ? `Estado: ${estadoEmail}. Los emails se envían al instante.`
                : `${estadoEmail}. Configura RESEND_API_KEY o el modo MAIL_MODE=smtp-dev para activar el envío.`}
            </p>
          </div>
          {emailOperativo ? (
            <Badge variant="green">{estadoEmail}</Badge>
          ) : (
            <Badge variant="amber">{estadoEmail}</Badge>
          )}
        </CardContent>
      </Card>

      <NotificacionesForm
        recordatorio24h={settings?.recordatorio24h ?? true}
        confirmacionSolicitud={settings?.confirmacionSolicitud ?? true}
        emailOperativo={emailOperativo}
        plantillaRecordatorio={settings?.plantillaRecordatorio ?? "recordatorio_cita"}
        idiomaPlantilla={settings?.idiomaPlantilla ?? "es"}
        resenaAutomatica={settings?.resenaAutomatica ?? false}
        recallAuto={settings?.recallAuto ?? false}
        noShowRecovery={settings?.noShowRecovery ?? true}
        digestDiario={settings?.digestDiario ?? true}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="p-5 pb-4">
            <CardTitle className="text-sm font-medium">Cómo funciona cada aviso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            <Canal
              icon={Check}
              label="Confirmación de solicitud"
              detail="Al confirmar o rechazar, el paciente recibe su hora y un enlace privado para reprogramar o cancelar sin crear cuenta."
            />
            <Canal
              icon={Bell}
              label="Recordatorio 24 h"
              detail="Se envía el día anterior a cada cita confirmada. Puedes enviar el lote desde la consola."
            />
            <Canal
              icon={MessageSquare}
              label="SMS"
              detail="Disponible cuando configures un proveedor SMS."
            />
            <Canal
              icon={Smartphone}
              label="WhatsApp"
              detail="Integración con la Cloud API oficial, disponible como servicio adicional."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5 pb-4">
            <CardTitle className="text-sm font-medium">Link mágico del paciente</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 text-sm text-muted-foreground">
            <p>
              Cada confirmación incluye un enlace privado para que el paciente reprograme
              o cancele su cita sin crear cuenta. El enlace vence a los 30 días.
            </p>
            <p className="mt-2">
              También se genera para solicitudes confirmadas aunque el paciente no haya
              dejado correo: puedes copiarlo desde la ficha de la solicitud.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Canal({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof Bell;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
