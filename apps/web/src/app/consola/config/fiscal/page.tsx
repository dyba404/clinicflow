import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { hasPermission } from "@clinicflow/core";
import { getDb, vatSettings } from "@clinicflow/db";
import { Building2, FileCheck2, Lock, Send, ShieldCheck, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { FiscalForm, type FiscalInicial } from "./fiscal-form";
import { getDefaultTeam } from "@/lib/console-data";
import { getSession } from "@/lib/auth";
import { gatePlan } from "@/lib/plans";
import { PlanGate } from "@/components/console/plan-gate";
import { masterKeyConfigurada } from "@/lib/crypto";
import { lycetConfigurado, lycetUrl } from "@/lib/lycet";

export const dynamic = "force-dynamic";

const REGIMEN_LABEL: Record<string, string> = {
  RUS: "Nuevo RUS",
  RER: "Régimen Especial",
  MYPE: "Régimen MYPE Tributario",
};

async function sidecarAccesible(): Promise<boolean> {
  if (!lycetConfigurado()) return false;
  try {
    const res = await fetch(lycetUrl(), {
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    return Number.isInteger(res.status);
  } catch {
    return false;
  }
}

export default async function FiscalConfigPage() {
  const team = await getDefaultTeam();
  const session = await getSession();
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "vat.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Facturación electrónica"
          description="Configuración de emisión ante SUNAT."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo el rol Dueño/a puede editar la configuración fiscal."
          />
        </Card>
      </div>
    );
  }

  const planCheck = await gatePlan(team.id, "facturacion");
  if (!planCheck.ok) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Facturación electrónica"
          description="Configuración de emisión ante SUNAT."
        />
        <PlanGate feature="facturacion" requerido={planCheck.requerido} />
      </div>
    );
  }

  const [[config], sidecarOk] = await Promise.all([
    getDb()
      .select()
      .from(vatSettings)
      .where(eq(vatSettings.tenantId, team.id))
      .limit(1),
    sidecarAccesible(),
  ]);

  const datosConfigurados = Boolean(config?.ruc && config?.claveSolEnc && config?.certificadoEnc);
  const electronico = config?.emision === "electronica";

  const inicial: FiscalInicial | null = config
    ? {
        ruc: config.ruc,
        razonSocial: config.razonSocial,
        regimen: config.regimen,
        ambiente: config.ambiente,
        usuarioSol: config.usuarioSol,
        claveSolConfigurada: Boolean(config.claveSolEnc),
        certificadoConfigurado: Boolean(config.certificadoEnc),
        serieBoleta: config.serieBoleta,
        serieFactura: config.serieFactura,
        corrBoleta: config.corrBoleta,
        corrFactura: config.corrFactura,
        emision: config.emision,
        emisionAuto: config.emisionAuto,
      }
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Facturación electrónica"
        description="Datos fiscales, certificado digital y modo de emisión ante SUNAT."
        action={
          <FiscalForm
            inicial={inicial}
            masterKeyOk={masterKeyConfigurada()}
            lycetConfigurado={lycetConfigurado()}
            sidecarOk={sidecarOk}
          />
        }
      />

      {!electronico ? (
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700">
              <Send className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Emisión en modo manual</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Configura tu RUC, Clave SOL y certificado para emitir comprobantes
                electrónicos vía SUNAT. Mientras tanto, los comprobantes se registran en
                modo manual.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="size-4 text-muted-foreground" />
              Datos fiscales
            </CardTitle>
            {datosConfigurados ? (
              <Badge variant="green">Configurado</Badge>
            ) : (
              <Badge variant="gray">Sin configurar</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-1.5 p-5 pt-0">
            <Linea label="RUC" valor={config?.ruc ?? null} />
            <Linea label="Razón social" valor={config?.razonSocial ?? null} />
            <Linea
              label="Régimen"
              valor={config ? REGIMEN_LABEL[config.regimen] ?? config.regimen : null}
            />
            <Linea
              label="Ambiente"
              valor={config ? (config.ambiente === "produccion" ? "Producción" : "Beta") : null}
            />
            <Linea
              label="Series"
              valor={
                config
                  ? `Boleta ${config.serieBoleta} · Factura ${config.serieFactura} · Notas ${config.serieBoleta.charAt(0)}N${config.serieBoleta.slice(1)}/${config.serieFactura.charAt(0)}N${config.serieFactura.slice(1)}`
                  : null
              }
            />
            <Linea
              label="Correlativos"
              valor={
                config
                  ? `Boleta ${config.corrBoleta} · Factura ${config.corrFactura}`
                  : null
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-muted-foreground" />
              Certificado digital
            </CardTitle>
            {config?.certificadoEnc ? (
              <Badge variant="green">Cargado</Badge>
            ) : (
              <Badge variant="gray">Sin cargar</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-1.5 p-5 pt-0">
            <Linea
              label="Archivo PEM"
              valor={config?.certificadoEnc ? "Cargado y cifrado" : null}
            />
            <Linea label="Clave SOL" valor={config?.claveSolEnc ? "Registrada" : null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="size-4 text-muted-foreground" />
              Sidecar Greenter/licet
            </CardTitle>
            {sidecarOk ? (
              <Badge variant="green">Conectado</Badge>
            ) : lycetConfigurado() ? (
              <Badge variant="amber">Sin conexión</Badge>
            ) : (
              <Badge variant="gray">Sin configurar</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-2 p-5 pt-0 text-sm text-muted-foreground">
            {lycetConfigurado() ? (
              <p>
                {sidecarOk
                  ? "El servicio de emisión está disponible y listo para enviar comprobantes."
                  : "LYCET_URL está definida pero el servicio no responde. Levántalo con docker compose up -d lycet."}
              </p>
            ) : (
              <p>
                Define LYCET_URL en .env.local y levanta el sidecar Greenter/licet
                para emitir electrónicamente.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileCheck2 className="size-4 text-muted-foreground" />
              Modo de emisión
            </CardTitle>
            {electronico ? <Badge variant="green">Electrónica</Badge> : <Badge variant="amber">Manual</Badge>}
          </CardHeader>
          <CardContent className="space-y-2 p-5 pt-0 text-sm text-muted-foreground">
            <p>
              En modo manual, los comprobantes se registran únicamente en caja. En modo
              electrónico, cada emisión se envía a SUNAT y se guarda el hash y el CDR.
            </p>
            {electronico ? (
              <p>
                {config?.emisionAuto
                  ? "Emisión automática al cobrar activada: cada pago de caja genera la boleta o factura y la envía a SUNAT sin pasos extra."
                  : "Emisión automática desactivada: los comprobantes se emiten de uno en uno desde Comprobantes."}
              </p>
            ) : null}
            <p>
              Cambia el modo con el botón Configurar facturación, en la cabecera. Mira el
              historial en <Link href="/consola/auditoria" className="font-medium text-primary hover:underline">Auditoría</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Linea({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={
          valor
            ? "text-right text-sm font-medium"
            : "text-right text-sm text-muted-foreground"
        }
      >
        {valor ?? "—"}
      </span>
    </div>
  );
}
