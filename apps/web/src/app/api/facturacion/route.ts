import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import {
  getDb,
  invoices,
  convenios,
  insurers,
  patients,
  admissions,
} from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ESTADOS = ["borrador", "emitida", "pagada", "anulada"] as const;
type Estado = (typeof ESTADOS)[number];

function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

interface ItemFactura {
  concepto: string;
  cantidad: number;
  precio: number;
}

function validarItems(input: unknown): ItemFactura[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > 50) return null;
  const items: ItemFactura[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const it = raw as Record<string, unknown>;
    const concepto = typeof it.concepto === "string" ? it.concepto.trim() : "";
    const cantidad = Number(it.cantidad);
    const precio = Number(it.precio);
    const esDescuento = concepto.toLowerCase().startsWith("descuento convenio");
    if (concepto.length < 2) return null;
    if (esDescuento && cantidad !== 1) return null;
    if (!Number.isFinite(cantidad) || cantidad <= 0) return null;
    if (!Number.isFinite(precio)) return null;
    if (precio < 0 && !esDescuento) return null;
    items.push({ concepto, cantidad, precio });
  }
  const total = redondear(items.reduce((acc, it) => acc + it.cantidad * it.precio, 0));
  if (total < 0) return null;
  return items;
}

export async function GET(req: Request) {
  const g = await guardStaff("billing.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const url = new URL(req.url);
  const estado = url.searchParams.get("estado");
  const patientId = url.searchParams.get("patientId");

  if (estado && !ESTADOS.includes(estado as Estado)) {
    return NextResponse.json({ error: "estado_invalido" }, { status: 400 });
  }

  const filtros = [eq(invoices.tenantId, g.team.id)];
  if (estado) filtros.push(eq(invoices.estado, estado as Estado));
  if (patientId) filtros.push(eq(invoices.patientId, patientId));

  const rows = await getDb()
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
    .where(and(...filtros))
    .orderBy(desc(invoices.createdAt));

  return NextResponse.json({
    facturas: rows.map((r) => ({ ...r, totalNum: Number(r.total) })),
  });
}

export async function POST(req: Request) {
  const g = await guardStaff("billing.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    patientId?: string;
    convenioId?: string;
    admissionId?: string;
    items?: unknown;
    total?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (!body.patientId) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const items = validarItems(body.items);
  if (!items) {
    return NextResponse.json({ error: "items_invalidos" }, { status: 400 });
  }

  const db = getDb();
  const [paciente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, body.patientId), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) {
    return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
  }

  let convenioId: string | null = null;
  if (body.convenioId) {
    const [convenio] = await db
      .select({ id: convenios.id })
      .from(convenios)
      .where(and(eq(convenios.id, body.convenioId), eq(convenios.tenantId, g.team.id)))
      .limit(1);
    if (!convenio) {
      return NextResponse.json({ error: "convenio_no_encontrado" }, { status: 404 });
    }
    convenioId = convenio.id;
  }

  let admissionId: string | null = null;
  if (body.admissionId) {
    const [admision] = await db
      .select({ id: admissions.id })
      .from(admissions)
      .where(and(eq(admissions.id, body.admissionId), eq(admissions.tenantId, g.team.id)))
      .limit(1);
    if (!admision) {
      return NextResponse.json({ error: "admision_no_encontrada" }, { status: 404 });
    }
    admissionId = admision.id;
  }

  const suma = redondear(items.reduce((acc, it) => acc + it.cantidad * it.precio, 0));
  let total = suma;
  if (typeof body.total !== "undefined" && body.total !== null) {
    const dado = Number(body.total);
    if (!Number.isFinite(dado)) {
      return NextResponse.json({ error: "total_incoherente" }, { status: 400 });
    }
    if (Math.abs(redondear(dado) - suma) > 0.02) {
      return NextResponse.json({ error: "total_incoherente" }, { status: 400 });
    }
    total = redondear(dado);
  }

  const [row] = await db
    .insert(invoices)
    .values({
      tenantId: g.team.id,
      patientId: paciente.id,
      convenioId,
      admissionId,
      items,
      total: total.toFixed(2),
      estado: "borrador",
      createdBy: g.user.id,
    })
    .returning({ id: invoices.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "factura.crear",
    entidad: "invoices",
    entidadId: row!.id,
    payload: {
      patientId: paciente.id,
      convenioId,
      admissionId,
      items: items.length,
      total,
    },
  });

  return NextResponse.json({ id: row!.id }, { status: 201 });
}
