import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, orders } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ESTADOS = [
  "ordenada",
  "toma",
  "procesada",
  "validada",
  "liberada",
  "entregada",
  "cancelada",
] as const;
type Estado = (typeof ESTADOS)[number];

const SIGUIENTE: Record<Exclude<Estado, "cancelada">, Estado | null> = {
  ordenada: "toma",
  toma: "procesada",
  procesada: "validada",
  validada: "liberada",
  liberada: "entregada",
  entregada: null,
};

const ATRAS: Record<Exclude<Estado, "cancelada">, Estado | null> = {
  ordenada: null,
  toma: "ordenada",
  procesada: "toma",
  validada: "procesada",
  liberada: "validada",
  entregada: "liberada",
};

const REQUIERE_RESULTADO: Estado[] = ["validada", "liberada"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("labs.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { estado?: string; motivoRevision?: string };
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
    .select({ id: orders.id, estado: orders.estado, rev: orders.rev, resultado: orders.resultado })
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.tenantId, g.team.id)))
    .limit(1);
  if (!actual) {
    return NextResponse.json({ error: "orden_no_encontrada" }, { status: 404 });
  }

  const actualEstado = actual.estado as Estado;
  const esRetroceso =
    actualEstado !== "cancelada" &&
    ATRAS[actualEstado as Exclude<Estado, "cancelada">] === estado;
  if (esRetroceso && (!body.motivoRevision || body.motivoRevision.trim().length < 3)) {
    return NextResponse.json({ error: "motivo_requerido_para_retroceder" }, { status: 400 });
  }

  const siguienteA = () =>
    actualEstado === "cancelada"
      ? null
      : SIGUIENTE[actualEstado as Exclude<Estado, "cancelada">];
  const permitido =
    estado === "cancelada"
      ? actualEstado !== "cancelada"
      : esRetroceso || siguienteA() === estado;
  if (actualEstado === estado || !permitido) {
    return NextResponse.json({ error: "transicion_invalida" }, { status: 409 });
  }

  if (REQUIERE_RESULTADO.includes(estado) && !actual.resultado) {
    return NextResponse.json({ error: "transicion_invalida" }, { status: 409 });
  }

  const [row] = await db
    .update(orders)
    .set({
      estado,
      motivoRevision: esRetroceso ? body.motivoRevision!.trim() : null,
      rev: esRetroceso ? actual.rev + 1 : actual.rev,
      validadoPor: estado === "validada" ? g.user.id : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, id), eq(orders.tenantId, g.team.id)))
    .returning({ id: orders.id, estado: orders.estado });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "orden.estado",
    entidad: "orders",
    entidadId: id,
    payload: {
      de: actualEstado,
      a: estado,
      motivoRevision: body.motivoRevision?.trim() ?? null,
      rev: esRetroceso ? actual.rev + 1 : actual.rev,
    },
  });

  return NextResponse.json({ ok: true, id: row!.id, estado: row!.estado });
}
