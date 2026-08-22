import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, quotes, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface ItemInput {
  servicioId?: string | null;
  descripcion?: string;
  cantidad?: number;
  precioUnitario?: number;
}

export async function GET() {
  const g = await guardStaff("patients.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "presupuestos");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const rows = await getDb()
    .select({
      id: quotes.id,
      patientId: quotes.patientId,
      patientNombre: patients.nombre,
      titulo: quotes.titulo,
      items: quotes.items,
      total: quotes.total,
      estado: quotes.estado,
      expiraEn: quotes.expiraEn,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .leftJoin(patients, eq(quotes.patientId, patients.id))
    .where(eq(quotes.tenantId, g.team.id))
    .orderBy(desc(quotes.createdAt))
    .limit(50);

  return NextResponse.json({
    presupuestos: rows.map((r) => ({
      ...r,
      itemsCount: Array.isArray(r.items) ? r.items.length : 0,
    })),
  });
}

export async function POST(req: Request) {
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "presupuestos");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: {
    patientId?: string;
    doctorId?: string | null;
    titulo?: string;
    items?: ItemInput[];
    expiraEn?: string | null;
    nota?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const titulo = body.titulo?.trim();
  if (!titulo || titulo.length < 1 || titulo.length > 80) {
    return NextResponse.json({ error: "titulo_invalido" }, { status: 400 });
  }

  if (!body.patientId) {
    return NextResponse.json({ error: "paciente_requerido" }, { status: 400 });
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

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "items_requeridos" }, { status: 400 });
  }
  const items: Array<{
    servicioId: string | null;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
  }> = [];
  for (const it of rawItems) {
    const descripcion = it.descripcion?.trim();
    if (!descripcion || descripcion.length < 1 || descripcion.length > 120) {
      return NextResponse.json({ error: "item_descripcion_invalida" }, { status: 400 });
    }
    const cantidad = Number(it.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      return NextResponse.json({ error: "item_cantidad_invalida" }, { status: 400 });
    }
    const precioUnitario = Number(it.precioUnitario);
    if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
      return NextResponse.json({ error: "item_precio_invalido" }, { status: 400 });
    }
    items.push({
      servicioId: it.servicioId ?? null,
      descripcion,
      cantidad,
      precioUnitario: Math.round(precioUnitario * 100) / 100,
    });
  }

  const total = Math.round(items.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0) * 100) / 100;
  const expiraEn =
    body.expiraEn && /^\d{4}-\d{2}-\d{2}$/.test(body.expiraEn) ? body.expiraEn : null;
  const nota = body.nota?.trim() || null;

  const [row] = await db
    .insert(quotes)
    .values({
      tenantId: g.team.id,
      patientId: paciente.id,
      doctorId: body.doctorId ?? null,
      titulo,
      items,
      total: total.toFixed(2),
      estado: "borrador",
      expiraEn,
      nota,
      createdBy: g.user.id,
    })
    .returning({
      id: quotes.id,
      titulo: quotes.titulo,
      total: quotes.total,
      estado: quotes.estado,
    });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "presupuesto.crear",
    entidad: "quotes",
    entidadId: row!.id,
    payload: { patientId: paciente.id, total, items: items.length },
  });

  return NextResponse.json({ ok: true, presupuesto: row }, { status: 201 });
}
