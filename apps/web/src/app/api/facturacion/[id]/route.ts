import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, invoices } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ESTADOS = ["borrador", "emitida", "pagada", "anulada"] as const;
type Estado = (typeof ESTADOS)[number];

function transicionValida(de: Estado, a: Estado): boolean {
  return (
    (de === "borrador" && a === "emitida") ||
    (de === "emitida" && (a === "pagada" || a === "anulada"))
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("billing.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { estado?: string; motivoPago?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const estado = body.estado as Estado | undefined;
  if (!estado || !ESTADOS.includes(estado)) {
    return NextResponse.json({ error: "estado_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [actual] = await db
    .select({ id: invoices.id, estado: invoices.estado, total: invoices.total })
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, g.team.id)))
    .limit(1);
  if (!actual) {
    return NextResponse.json({ error: "factura_no_encontrada" }, { status: 404 });
  }

  if (!transicionValida(actual.estado as Estado, estado)) {
    return NextResponse.json({ error: "transicion_invalida" }, { status: 409 });
  }

  if (estado === "anulada" && (!body.motivoPago || body.motivoPago.trim().length < 3)) {
    return NextResponse.json({ error: "motivo_requerido" }, { status: 400 });
  }

  const set: {
    estado: Estado;
    emitidaAt?: Date;
    pagadaAt?: Date;
    anuladaMotivo?: string;
  } = { estado };
  if (estado === "emitida") set.emitidaAt = new Date();
  if (estado === "pagada") set.pagadaAt = new Date();
  if (estado === "anulada") set.anuladaMotivo = body.motivoPago!.trim();

  const [row] = await db
    .update(invoices)
    .set({ ...set, updatedAt: new Date() })
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, g.team.id)))
    .returning({ id: invoices.id, estado: invoices.estado });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "factura.estado",
    entidad: "invoices",
    entidadId: id,
    payload: {
      de: actual.estado,
      a: estado,
      motivo: estado === "anulada" ? set.anuladaMotivo : null,
      total: Number(actual.total),
    },
  });

  return NextResponse.json({ ok: true, id: row!.id, estado: row!.estado });
}
