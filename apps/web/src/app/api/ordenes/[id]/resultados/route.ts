import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb, orders, orderResults, patients, users } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff();
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [orden] = await db
    .select({
      id: orders.id,
      tipo: orders.tipo,
      estado: orders.estado,
      nombre: orders.nombre,
      patientNombre: patients.nombre,
      createdAt: orders.createdAt,
      validadoPorNombre: users.name,
    })
    .from(orders)
    .innerJoin(patients, eq(orders.patientId, patients.id))
    .leftJoin(users, eq(orders.validadoPor, users.id))
    .where(and(eq(orders.id, id), eq(orders.tenantId, g.team.id)))
    .limit(1);
  if (!orden) {
    return NextResponse.json({ error: "orden_no_encontrada" }, { status: 404 });
  }

  const filas = await db
    .select()
    .from(orderResults)
    .where(eq(orderResults.orderId, orden.id))
    .orderBy(asc(orderResults.createdAt));

  return NextResponse.json({
    resultados: {
      id: orden.id,
      tipo: orden.tipo,
      estado: orden.estado,
      nombre: orden.nombre,
      paciente: { nombre: orden.patientNombre },
      createdAt: orden.createdAt,
      validadoPor: orden.validadoPorNombre ? { nombre: orden.validadoPorNombre } : null,
      resultados: filas,
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("labs.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    resultados?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (!Array.isArray(body.resultados)) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }
  if (body.resultados.length < 1 || body.resultados.length > 30) {
    return NextResponse.json({ error: "fuera_de_rango" }, { status: 400 });
  }

  const filas: Array<{
    parametro: string;
    valorText: string | null;
    valorNum: string | null;
    unidad: string | null;
    referencia: string | null;
    flag: string | null;
  }> = [];
  for (const raw of body.resultados) {
    if (typeof raw !== "object" || raw === null) {
      return NextResponse.json({ error: "fila_invalida" }, { status: 400 });
    }
    const fila = raw as Record<string, unknown>;
    const parametro = typeof fila.parametro === "string" ? fila.parametro.trim() : "";
    if (parametro.length < 1) {
      return NextResponse.json({ error: "parametro_invalido" }, { status: 400 });
    }
    let valorText: string | null = null;
    if (typeof fila.valorText === "string" && fila.valorText.trim()) {
      valorText = fila.valorText.trim().slice(0, 200);
    }
    let valorNum: string | null = null;
    if (typeof fila.valorNum !== "undefined" && fila.valorNum !== null && fila.valorNum !== "") {
      const n = Number(fila.valorNum);
      if (!Number.isFinite(n)) {
        return NextResponse.json({ error: "valor_invalido" }, { status: 400 });
      }
      valorNum = n.toFixed(6);
    }
    if (valorText === null && valorNum === null) {
      return NextResponse.json({ error: "valor_requerido" }, { status: 400 });
    }
    const corto = (v: unknown, max: number) =>
      typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
    filas.push({
      parametro: parametro.slice(0, 120),
      valorText,
      valorNum,
      unidad: corto(fila.unidad, 40),
      referencia: corto(fila.referencia, 120),
      flag: corto(fila.flag, 20),
    });
  }

  const db = getDb();
  const [orden] = await db
    .select({ id: orders.id, tipo: orders.tipo, estado: orders.estado })
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.tenantId, g.team.id)))
    .limit(1);
  if (!orden) {
    return NextResponse.json({ error: "orden_no_encontrada" }, { status: 404 });
  }
  if (orden.tipo !== "laboratorio") {
    return NextResponse.json({ error: "tipo_no_laboratorio" }, { status: 400 });
  }
  if (!["toma", "procesada", "validada"].includes(orden.estado)) {
    return NextResponse.json({ error: "estado_sin_resultado" }, { status: 409 });
  }

  await db.transaction(async (tx) => {
    await tx.delete(orderResults).where(eq(orderResults.orderId, orden.id));
    if (filas.length > 0) {
      await tx.insert(orderResults).values(
        filas.map((f) => ({
          orderId: orden.id,
          parametro: f.parametro,
          valorText: f.valorText,
          valorNum: f.valorNum,
          unidad: f.unidad,
          referencia: f.referencia,
          flag: f.flag,
        })),
      );
    }
    await tx
      .update(orders)
      .set({
        resultado: filas.length > 0 ? { filas: filas.length } : null,
        resultadoAt: filas.length > 0 ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orden.id));
  });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "resultado.cargar",
    entidad: "orders",
    entidadId: orden.id,
    payload: { filas: filas.length },
  });

  return NextResponse.json({ ok: true, id: orden.id, filas: filas.length }, { status: 201 });
}
