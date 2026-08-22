import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, receipts, payments, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86_400_000;

const TIPO_LABEL: Record<string, string> = {
  boleta: "Boleta",
  factura: "Factura",
  nota_credito: "Nota de crédito",
  nota_debito: "Nota de débito",
};

const SUNAT_LABEL: Record<string, string> = {
  manual: "Manual",
  pendiente_envio: "Pendiente de envío",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  baja: "De baja",
  baja_pendiente: "Baja enviada",
  baja_aceptada: "De baja (anulado)",
  baja_rechazada: "Baja rechazada",
};

function fechaLima(desplazamientoDias = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(
    new Date(Date.now() + desplazamientoDias * DIA_MS),
  );
}

function validaFecha(valor: string): boolean {
  return RE_FECHA.test(valor) && !Number.isNaN(Date.parse(`${valor}T12:00:00`));
}

function fechaCorta(d: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(d);
}

export async function GET(req: Request) {
  const g = await guardStaff("reports.view_all");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "export_sunat");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const url = new URL(req.url);
  const paramDesde = url.searchParams.get("desde") ?? "";
  const paramHasta = url.searchParams.get("hasta") ?? "";
  const desde = validaFecha(paramDesde) ? paramDesde : fechaLima(-29);
  const hasta = validaFecha(paramHasta) ? paramHasta : fechaLima();

  const inicio = new Date(`${desde}T00:00:00-05:00`);
  const fin = new Date(`${hasta}T23:59:59.999-05:00`);
  if (inicio.getTime() > fin.getTime()) {
    return NextResponse.json({ error: "rango_invalido" }, { status: 400 });
  }

  const afectados = alias(receipts, "afectados");
  const filas = await getDb()
    .select({
      id: receipts.id,
      tipo: receipts.tipo,
      serie: receipts.serie,
      correlativo: receipts.correlativo,
      sunatEstado: receipts.sunatEstado,
      emitidaAt: receipts.emitidaAt,
      createdAt: receipts.createdAt,
      monto: payments.monto,
      clienteNombre: patients.nombre,
      clienteDoc: patients.documento,
      afectadoSerie: afectados.serie,
      afectadoCorrelativo: afectados.correlativo,
    })
    .from(receipts)
    .innerJoin(payments, eq(receipts.paymentId, payments.id))
    .leftJoin(patients, eq(payments.patientId, patients.id))
    .leftJoin(afectados, eq(receipts.afectadoId, afectados.id))
    .where(
      and(
        eq(receipts.tenantId, g.team.id),
        eq(payments.estado, "valido"),
        gte(receipts.createdAt, inicio),
        lte(receipts.createdAt, fin),
      ),
    )
    .orderBy(asc(receipts.createdAt));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Clinicflow";
  const hoja = workbook.addWorksheet("ventas");
  hoja.columns = [
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Tipo", key: "tipo", width: 14 },
    { header: "Comprobante", key: "comprobante", width: 18 },
    { header: "Anula a", key: "anulaA", width: 18 },
    { header: "Cliente", key: "cliente", width: 36 },
    { header: "Documento", key: "documento", width: 14 },
    { header: "Monto (S/)", key: "monto", width: 13 },
    { header: "Estado SUNAT", key: "estadoSunat", width: 18 },
  ];
  hoja.getRow(1).font = { bold: true };

  let total = 0;
  for (const fila of filas) {
    const esNotaCredito = fila.tipo === "nota_credito";
    const monto = esNotaCredito ? -Math.abs(Number(fila.monto)) : Number(fila.monto);
    total += monto;
    const anulaA =
      fila.afectadoSerie && fila.afectadoCorrelativo
        ? `${fila.afectadoSerie}-${String(fila.afectadoCorrelativo).padStart(8, "0")}`
        : "";
    const registro = hoja.addRow({
      fecha: fechaCorta(fila.emitidaAt ?? fila.createdAt),
      tipo: TIPO_LABEL[fila.tipo] ?? fila.tipo,
      comprobante: `${fila.serie}-${String(fila.correlativo).padStart(8, "0")}`,
      anulaA,
      cliente: fila.clienteNombre ?? "Sin cliente",
      documento: fila.clienteDoc ?? "",
      monto,
      estadoSunat: SUNAT_LABEL[fila.sunatEstado] ?? fila.sunatEstado,
    });
    registro.getCell("monto").numFmt = "#,##0.00";
  }

  hoja.addRow([]);
  const resumen = hoja.addRow({
    comprobante: "TOTAL",
    cliente: `${filas.length} comprobante(s)`,
    monto: total,
  });
  resumen.font = { bold: true };
  resumen.getCell("monto").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "reporte.exportar_sunat",
    entidad: "receipts",
    payload: { desde, hasta, comprobantes: filas.length, total },
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ventas_${desde}_${hasta}.xlsx"`,
    },
  });
}
