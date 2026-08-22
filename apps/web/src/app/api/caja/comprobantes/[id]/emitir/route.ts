import { NextResponse } from "next/server";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { emitirComprobante, consultarCdrComprobante } from "@/lib/emitir";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardStaff("receipts.issue");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "facturacion");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);
  const { id } = await params;

  let body: { consultarCdr?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  if (body.consultarCdr) {
    const cdr = await consultarCdrComprobante({
      tenantId: g.team.id,
      receiptId: id,
      usuarioId: g.user.id,
    });
    if (!cdr.ok) {
      return NextResponse.json(
        { error: cdr.error, ...(cdr.message ? { message: cdr.message } : {}) },
        { status: cdr.status },
      );
    }
    return NextResponse.json({ ok: true, estado: cdr.estado, message: cdr.message ?? null });
  }

  const res = await emitirComprobante({
    tenantId: g.team.id,
    receiptId: id,
    usuarioId: g.user.id,
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: res.error, ...("message" in res && res.message ? { message: res.message } : {}) },
      { status: res.status },
    );
  }

  return NextResponse.json({
    ok: true,
    hash: res.hash,
    xmlUrl: res.xmlUrl,
    cdrUrl: res.cdrUrl,
    cdrPendiente: res.cdrPendiente,
  });
}
