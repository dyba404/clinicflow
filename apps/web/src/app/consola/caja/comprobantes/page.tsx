import { Download, Lock, Receipt, Settings } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { hasPermission } from "@clinicflow/core";
import { getDb, patients, payments, receipts, vatSettings } from "@clinicflow/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { ComprobanteDialog } from "./comprobante-dialog";
import { EmitirButton } from "./emitir-button";
import { BajaButton } from "./baja-button";
import { ConsultarCdrButton } from "./consultar-cdr-button";
import { LogoComprobanteDialog } from "./logo-comprobante-dialog";
import { EditarComprobanteManual } from "./editar-comprobante-manual";
import { ExportSunatButton } from "./export-sunat-button";
import { getDefaultTeam, pagosSinComprobante, ultimoCorrelativo } from "@/lib/console-data";
import { getSession } from "@/lib/auth";
import { gatePlan } from "@/lib/plans";
import { stat } from "node:fs/promises";
import { logoComprobantePath } from "@/lib/comprobante-pdf";
import { PlanGate } from "@/components/console/plan-gate";
import { fmtPEN } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const TIPO_BADGE: Record<string, "secondary" | "green" | "gray"> = {
  boleta: "secondary",
  factura: "green",
  nota_credito: "gray",
  nota_debito: "gray",
};

const TIPO_LABEL: Record<string, string> = {
  boleta: "Boleta",
  factura: "Factura",
  nota_credito: "Nota de crédito",
  nota_debito: "Nota de débito",
};

const METODO_BADGE: Record<string, "teal" | "amber" | "green" | "blue" | "violet" | "gray"> = {
  yape: "violet",
  plin: "teal",
  efectivo: "green",
  tarjeta_pos: "blue",
  tarjeta_online: "amber",
  otro: "gray",
};

const METODO_LABEL: Record<string, string> = {
  yape: "Yape",
  plin: "Plin",
  efectivo: "Efectivo",
  tarjeta_pos: "Tarjeta POS",
  tarjeta_online: "Tarjeta online",
  otro: "Otro",
};

const SUNAT_BADGE: Record<string, "gray" | "amber" | "green" | "red"> = {
  manual: "gray",
  pendiente_envio: "amber",
  aceptado: "green",
  rechazado: "red",
  baja: "red",
  baja_pendiente: "amber",
  baja_aceptada: "gray",
  baja_rechazada: "red",
};

const SUNAT_LABEL: Record<string, string> = {
  manual: "Manual",
  pendiente_envio: "Pendiente de envío",
  aceptado: "Aceptado SUNAT",
  rechazado: "Rechazado SUNAT",
  baja: "De baja",
  baja_pendiente: "Baja enviada",
  baja_aceptada: "De baja",
  baja_rechazada: "Baja rechazada",
};

function fechaCorta(d: Date | string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(typeof d === "string" ? new Date(d) : d);
}

function urlArchivo(url: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/")) return `/api/fiscal/archivo${url}`;
  return url;
}

export default async function ComprobantesPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  const role = session.role;

  if (!hasPermission(role, "receipts.issue")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo dueños y recepción pueden emitir comprobantes."
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
          title="Comprobantes"
          description="Emisión de boletas y facturas contra cada pago."
        />
        <PlanGate feature="facturacion" requerido={planCheck.requerido} />
      </div>
    );
  }

  const db = getDb();
  const afectados = alias(receipts, "afectados");
  const [lista, sinComprobante, ultimoBoleta, fiscal, hayLogo] = await Promise.all([
    db
      .select({
        id: receipts.id,
        tipo: receipts.tipo,
        serie: receipts.serie,
        correlativo: receipts.correlativo,
        estado: receipts.estado,
        sunatEstado: receipts.sunatEstado,
        xmlUrl: receipts.xmlUrl,
        cdrUrl: receipts.cdrUrl,
        pdfUrl: receipts.pdfUrl,
        afectadoId: receipts.afectadoId,
        emitidaAt: receipts.emitidaAt,
        bajaTicket: receipts.bajaTicket,
        createdAt: receipts.createdAt,
        monto: payments.monto,
        metodo: payments.metodo,
        patientNombre: patients.nombre,
        afectadoSerie: afectados.serie,
        afectadoCorrelativo: afectados.correlativo,
      })
      .from(receipts)
      .innerJoin(payments, eq(receipts.paymentId, payments.id))
      .leftJoin(patients, eq(payments.patientId, patients.id))
      .leftJoin(afectados, eq(receipts.afectadoId, afectados.id))
      .where(eq(receipts.tenantId, team.id))
      .orderBy(desc(receipts.createdAt)),
    pagosSinComprobante(team.id),
    ultimoCorrelativo(team.id, "boleta", "B001"),
    db
      .select({ emision: vatSettings.emision })
      .from(vatSettings)
      .where(eq(vatSettings.tenantId, team.id))
      .limit(1)
      .then((r) => r[0] ?? null),
    stat(logoComprobantePath(team.id))
      .then(() => true)
      .catch(() => false),
  ]);

  const emisionManual = (fiscal?.emision ?? "manual") === "manual";
  const puedeConfigurar = hasPermission(role, "vat.manage");

  const pagosOpciones = sinComprobante.map((p) => ({
    id: p.id,
    label: `${fmtPEN(Number(p.monto))} ${METODO_LABEL[p.metodo] ?? p.metodo} — ${p.patientNombre ?? "Sin paciente"} ${p.createdAt ? fechaCorta(p.createdAt) : ""}`.trim(),
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Comprobantes"
        description={
          emisionManual
            ? "Emisión manual de boletas y facturas contra cada pago. Configura RUC, Clave SOL y certificado para activar la facturación electrónica."
            : "Emisión electrónica de boletas y facturas contra cada pago (envío a SUNAT)."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {hasPermission(role, "reports.view_all") ? <ExportSunatButton /> : null}
            <LogoComprobanteDialog hayLogo={hayLogo} />
            {puedeConfigurar ? (
              <Link
                href="/consola/config/fiscal"
                className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-card px-3 text-xs font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Settings className="size-3.5" />
                Configuración fiscal
              </Link>
            ) : null}
            <ComprobanteDialog
              pagos={pagosOpciones}
              serieSugerida="B001"
              correlativoSugerido={(ultimoBoleta ?? 0) + 1}
            />
          </div>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>SUNAT</TableHead>
              <TableHead>Archivos</TableHead>
              <TableHead className="text-right">Emitido</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    icon={Receipt}
                    title="Aún no hay comprobantes"
                    description="Emite el primero asociándolo a un pago registrado en caja."
                  />
                </TableCell>
              </TableRow>
            ) : (
              lista.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="whitespace-nowrap text-sm font-medium tabular-nums">
                    {c.serie}-{String(c.correlativo).padStart(8, "0")}
                    {c.afectadoSerie && c.afectadoCorrelativo ? (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        anula {c.afectadoSerie}-{String(c.afectadoCorrelativo).padStart(8, "0")}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={TIPO_BADGE[c.tipo] ?? "gray"}>
                      {TIPO_LABEL[c.tipo] ?? c.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">
                    <span className="font-semibold">{fmtPEN(Number(c.monto))}</span>
                    <Badge variant={METODO_BADGE[c.metodo] ?? "gray"} className="ml-2">
                      {METODO_LABEL[c.metodo] ?? c.metodo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.patientNombre ?? (
                      <span className="text-muted-foreground">Sin paciente</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={SUNAT_BADGE[c.sunatEstado] ?? "gray"}>
                      {SUNAT_LABEL[c.sunatEstado] ?? c.sunatEstado}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {c.xmlUrl || c.cdrUrl || c.sunatEstado !== "manual" ? (
                      <span className="inline-flex items-center gap-2">
                        {c.xmlUrl ? (
                          <a
                            href={urlArchivo(c.xmlUrl)}
                            download
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Download className="size-3.5" />
                            XML
                          </a>
                        ) : null}
                        {c.cdrUrl ? (
                          <a
                            href={urlArchivo(c.cdrUrl)}
                            download
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Download className="size-3.5" />
                            CDR
                          </a>
                        ) : null}
                        <a
                          href={`/api/caja/comprobantes/${c.id}/pdf`}
                          download
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Download className="size-3.5" />
                          PDF
                        </a>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">
                    {fechaCorta(c.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <EmitirButton id={c.id} sunatEstado={c.sunatEstado} />
                      {c.sunatEstado === "pendiente_envio" && c.emitidaAt ? (
                        <ConsultarCdrButton
                          id={c.id}
                          numero={`${c.serie}-${String(c.correlativo).padStart(8, "0")}`}
                        />
                      ) : null}
                      {c.tipo === "boleta" || c.tipo === "factura" ? (
                        <BajaButton
                          id={c.id}
                          serie={c.serie}
                          correlativo={c.correlativo}
                          sunatEstado={c.sunatEstado}
                          tipo={c.tipo}
                          emitidaAt={c.emitidaAt ? c.emitidaAt.toISOString() : null}
                          bajaTicket={c.bajaTicket}
                        />
                      ) : null}
                      {c.sunatEstado === "manual" ? (
                        <>
                          <EditarComprobanteManual
                            id={c.id}
                            numero={`${c.serie}-${String(c.correlativo).padStart(8, "0")}`}
                            serieInicial={c.serie}
                            correlativoInicial={c.correlativo}
                            modo="editar"
                          />
                          <EditarComprobanteManual
                            id={c.id}
                            numero={`${c.serie}-${String(c.correlativo).padStart(8, "0")}`}
                            serieInicial={c.serie}
                            correlativoInicial={c.correlativo}
                            modo="anular"
                          />
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
