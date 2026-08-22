import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, quotes, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";
import { appBaseUrl, mailConfigurado, sendMail } from "@/lib/mail";
import { plantillaPresupuestoAprobado } from "@/lib/notify";

export const dynamic = "force-dynamic";

const ESTADOS = ["borrador", "enviado", "aprobado", "rechazado", "convertido"] as const;
type Estado = (typeof ESTADOS)[number];

const SIGUIENTE: Partial<Record<Estado, Estado[]>> = {
  borrador: ["enviado", "rechazado"],
  enviado: ["aprobado", "rechazado"],
  aprobado: ["convertido"],
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "presupuestos");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const [row] = await getDb()
    .select({
      id: quotes.id,
      patientId: quotes.patientId,
      patientNombre: patients.nombre,
      titulo: quotes.titulo,
      items: quotes.items,
      total: quotes.total,
      estado: quotes.estado,
      expiraEn: quotes.expiraEn,
      nota: quotes.nota,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .leftJoin(patients, eq(quotes.patientId, patients.id))
    .where(and(eq(quotes.id, id), eq(quotes.tenantId, g.team.id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "presupuesto_no_encontrado" }, { status: 404 });
  }
  return NextResponse.json({ presupuesto: row });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "presupuestos");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: { estado?: string };
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
    .select({
      id: quotes.id,
      patientId: quotes.patientId,
      titulo: quotes.titulo,
      items: quotes.items,
      total: quotes.total,
      estado: quotes.estado,
      patientEmail: patients.email,
    })
    .from(quotes)
    .leftJoin(patients, eq(quotes.patientId, patients.id))
    .where(and(eq(quotes.id, id), eq(quotes.tenantId, g.team.id)))
    .limit(1);
  if (!actual) {
    return NextResponse.json({ error: "presupuesto_no_encontrado" }, { status: 404 });
  }

  const permitidos = SIGUIENTE[actual.estado as Estado] ?? [];
  if (actual.estado === estado || !permitidos.includes(estado)) {
    return NextResponse.json({ error: "transicion_invalida" }, { status: 400 });
  }

  const [row] = await db
    .update(quotes)
    .set({ estado, updatedAt: new Date() })
    .where(and(eq(quotes.id, id), eq(quotes.tenantId, g.team.id)))
    .returning({ id: quotes.id, estado: quotes.estado });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "presupuesto.estado",
    entidad: "quotes",
    entidadId: id,
    payload: { de: actual.estado, a: estado },
  });

  let emailEnviado = false;
  if (estado === "aprobado" && actual.patientEmail && mailConfigurado()) {
    try {
      const items = Array.isArray(actual.items)
        ? (actual.items as Array<{
            descripcion: string;
            cantidad: number;
            precioUnitario: number;
          }>)
        : [];
      const tpl = plantillaPresupuestoAprobado({
        clinicaNombre: g.team.name,
        clinicaSlug: g.team.slug,
        titulo: actual.titulo,
        items,
        total: Number(actual.total),
        reservaUrl: `${appBaseUrl()}/${g.team.slug}/reserva`,
      });
      const r = await sendMail({
        to: actual.patientEmail,
        subject: tpl.asunto,
        html: tpl.html,
        text: tpl.texto,
      });
      emailEnviado = r.ok;
    } catch {
      emailEnviado = false;
    }
  }

  return NextResponse.json({
    ok: true,
    id: row!.id,
    estado: row!.estado,
    emailEnviado: emailEnviado || undefined,
  });
}
