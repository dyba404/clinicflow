import { redirect } from "next/navigation";
import { Lock, Receipt } from "lucide-react";
import { hasPermission } from "@clinicflow/core";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, invoices, convenios, insurers, patients } from "@clinicflow/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { getSession } from "@/lib/auth";
import {
  FacturacionPanel,
  type ConvenioFila,
  type FacturaFila,
  type ItemFactura,
} from "./facturacion-panel";

export const dynamic = "force-dynamic";

export default async function FacturacionPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "billing.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Facturación institucional"
          description="Convenios con aseguradoras y facturas de pacientes particulares o asegurados."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo los roles Dueña y Recepción pueden gestionar facturación."
          />
        </Card>
      </div>
    );
  }

  const db = getDb();
  const filasConvenios = await db
    .select({
      id: convenios.id,
      insurerId: convenios.insurerId,
      nombreAseguradora: insurers.nombre,
      tipo: convenios.tipo,
      descuentoPct: convenios.descuentoPct,
      activo: convenios.activo,
    })
    .from(convenios)
    .innerJoin(insurers, eq(convenios.insurerId, insurers.id))
    .where(eq(convenios.tenantId, session.teamId))
    .orderBy(asc(insurers.nombre));

  const conveniosLista: ConvenioFila[] = filasConvenios.map((c) => ({
    ...c,
    descuentoNum: Number(c.descuentoPct),
  }));

  const filasFacturas = await db
    .select({
      id: invoices.id,
      patientId: invoices.patientId,
      nombrePaciente: patients.nombre,
      convenioId: invoices.convenioId,
      nombreConvenio: insurers.nombre,
      admissionId: invoices.admissionId,
      items: invoices.items,
      total: invoices.total,
      estado: invoices.estado,
      emitidaAt: invoices.emitidaAt,
      pagadaAt: invoices.pagadaAt,
      anuladaMotivo: invoices.anuladaMotivo,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .innerJoin(patients, eq(invoices.patientId, patients.id))
    .leftJoin(convenios, eq(invoices.convenioId, convenios.id))
    .leftJoin(insurers, eq(convenios.insurerId, insurers.id))
    .where(eq(invoices.tenantId, session.teamId))
    .orderBy(desc(invoices.createdAt))
    .limit(200);

  const facturas: FacturaFila[] = filasFacturas.map((f) => ({
    id: f.id,
    patientId: f.patientId,
    nombrePaciente: f.nombrePaciente,
    convenioId: f.convenioId,
    nombreConvenio: f.nombreConvenio,
    admissionId: f.admissionId,
    items: Array.isArray(f.items)
      ? (f.items as ItemFactura[]).map((it) => ({
          concepto: String(it.concepto ?? ""),
          cantidad: Number(it.cantidad ?? 0),
          precio: Number(it.precio ?? 0),
        }))
      : [],
    totalNum: Number(f.total),
    estado: f.estado,
    emitidaAt: f.emitidaAt ? f.emitidaAt.toISOString() : null,
    pagadaAt: f.pagadaAt ? f.pagadaAt.toISOString() : null,
    anuladaMotivo: f.anuladaMotivo,
    createdAt: f.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Facturación institucional"
        description="Convenios con aseguradoras y facturas de pacientes: registra items, aplica descuentos y controla el estado."
      />
      {facturas.length === 0 && conveniosLista.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title="Sin convenios ni facturas todavía"
            description="Crea tu primer convenio con una aseguradora o una factura para un paciente."
          />
        </Card>
      ) : null}
      <FacturacionPanel convenios={conveniosLista} facturas={facturas} />
    </div>
  );
}
