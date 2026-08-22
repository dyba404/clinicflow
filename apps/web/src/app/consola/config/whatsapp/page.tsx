import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { hasPermission } from "@clinicflow/core";
import { getDb, whatsappSettings } from "@clinicflow/db";
import { Lock, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { WhatsAppForm } from "./whatsapp-form";
import { getDefaultTeam } from "@/lib/console-data";
import { getSession } from "@/lib/auth";
import { masterKeyConfigurada } from "@/lib/crypto";
import { appBaseUrl } from "@/lib/mail";

export const dynamic = "force-dynamic";

export default async function WhatsAppConfigPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "services.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="WhatsApp Cloud API"
          description="Conecta tu número de WhatsApp Business para enviar recordatorios."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo el rol Dueño/a puede editar la configuración de WhatsApp."
          />
        </Card>
      </div>
    );
  }

  const [fila] = await getDb()
    .select()
    .from(whatsappSettings)
    .where(eq(whatsappSettings.tenantId, team.id))
    .limit(1);

  const activo = fila?.activo ?? false;
  const configurado = Boolean(activo && fila?.phoneNumberId && fila?.tokenEnc);
  const webhookUrl = `${appBaseUrl()}/api/whatsapp/webhook`;
  const phoneMostrado = fila?.phoneNumberId
    ? `${fila.phoneNumberId.slice(0, 4)}••••${fila.phoneNumberId.slice(-4)}`
    : "Sin ID";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="WhatsApp Cloud API"
        description="Conecta tu número de WhatsApp Business (Meta) para enviar recordatorios por WhatsApp."
      />

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <MessageCircle className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Estado del canal</p>
            <p className="text-xs text-muted-foreground">
              Número: {phoneMostrado}
              {" · "}
              Webhook verificado: {fila?.webhookVerifiedAt ? "sí" : "pendiente de verificar"}
            </p>
          </div>
          {configurado ? (
            <Badge variant="green">Activo</Badge>
          ) : activo ? (
            <Badge variant="amber">Incompleto</Badge>
          ) : (
            <Badge variant="gray">Inactivo</Badge>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="p-5 pb-4">
            <CardTitle className="text-sm font-medium">Credenciales</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <WhatsAppForm
              phoneNumberId={fila?.phoneNumberId ?? null}
              activo={fila?.activo ?? false}
              tokenGuardado={Boolean(fila?.tokenEnc)}
              masterKeyOk={masterKeyConfigurada()}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Requiere una cuenta WhatsApp Business (Meta). Sin token, los recordatorios
              siguen por email.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5 pb-4">
            <CardTitle className="text-sm font-medium">Webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            <p className="text-sm text-muted-foreground">
              Pega esta URL en la sección de Webhooks de tu app en Meta for Developers y
              usa <span className="font-mono text-foreground">clinicflow-verify</span> como
              Verify Token.
            </p>
            <WebhookCopy url={webhookUrl} />
            <p className="text-xs text-muted-foreground">
              Al recibir mensajes entrantes, la app reconoce el evento y registra una
              auditoría con los primeros 40 caracteres del mensaje.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WebhookCopy({ url }: { url: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2">
      <span className="block select-all font-mono text-xs" title={url}>
        {url}
      </span>
    </div>
  );
}
