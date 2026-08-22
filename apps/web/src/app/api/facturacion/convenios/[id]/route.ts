import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, convenios, invoices } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("billing.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { activo?: boolean; descuentoPct?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (typeof body.activo === "undefined" && typeof body.descuentoPct === "undefined") {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const db = getDb();
  const [actual] = await db
    .select({ id: convenios.id, activo: convenios.activo })
    .from(convenios)
    .where(and(eq(convenios.id, id), eq(convenios.tenantId, g.team.id)))
    .limit(1);
  if (!actual) {
    return NextResponse.json({ error: "convenio_no_encontrado" }, { status: 404 });
  }

  const set: { activo?: boolean; descuentoPct?: string } = {};

  if (typeof body.descuentoPct !== "undefined") {
    const descuento = Number(body.descuentoPct);
    if (!Number.isFinite(descuento) || descuento < 0 || descuento > 100) {
      return NextResponse.json({ error: "descuento_invalido" }, { status: 400 });
    }
    set.descuentoPct = descuento.toFixed(2);
  }

  if (typeof body.activo !== "undefined") {
    if (body.activo === false && actual.activo === true) {
      const [facturada] = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, g.team.id),
            eq(invoices.convenioId, id),
            eq(invoices.estado, "emitida"),
          ),
        )
        .limit(1);
      if (facturada) {
        return NextResponse.json({ error: "convenio_con_facturas" }, { status: 409 });
      }
      set.activo = false;
    }
    if (body.activo === true) {
      set.activo = true;
    }
  }

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "sin_cambios" }, { status: 400 });
  }

  const [row] = await db
    .update(convenios)
    .set(set)
    .where(and(eq(convenios.id, id), eq(convenios.tenantId, g.team.id)))
    .returning({
      id: convenios.id,
      activo: convenios.activo,
      descuentoPct: convenios.descuentoPct,
    });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "convenio.actualizar",
    entidad: "convenios",
    entidadId: id,
    payload: { activo: body.activo, descuentoPct: body.descuentoPct },
  });

  return NextResponse.json({
    ok: true,
    convenio: { ...row, descuentoNum: Number(row!.descuentoPct) },
  });
}
