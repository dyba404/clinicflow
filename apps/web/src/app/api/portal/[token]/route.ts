import { NextResponse } from "next/server";
import { resolvePortalAccess } from "@/lib/portal-access";
import { rateLimit, ipReq } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { armarPortalData } from "@/lib/portal-data";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const limite = rateLimit(`portal:${token}:${ipReq(req)}`, 20);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  const r = await resolvePortalAccess(token);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 404 });
  const { ctx } = r;

  const data = await armarPortalData({
    patientId: ctx.patient.id,
    tenantId: ctx.team.id,
    clinicaNombre: ctx.team.name,
    clinicaSlug: ctx.team.slug,
    pacienteNombre: ctx.patient.nombre,
  });

  void logAudit({
    tenantId: ctx.team.id,
    accion: "portal.acceder",
    entidad: "patients",
    entidadId: ctx.patient.id,
    payload: { via: "token_portal" },
  });

  return NextResponse.json(data);
}
