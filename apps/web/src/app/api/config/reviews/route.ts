import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, teams } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardStaff("services.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const [team] = await getDb()
    .select({
      googlePlaceId: teams.googlePlaceId,
      googleReviewUrl: teams.googleReviewUrl,
    })
    .from(teams)
    .where(eq(teams.id, g.team.id))
    .limit(1);

  return NextResponse.json({
    googlePlaceId: team?.googlePlaceId ?? null,
    googleReviewUrl: team?.googleReviewUrl ?? null,
  });
}

export async function PUT(req: Request) {
  const g = await guardStaff("services.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { googlePlaceId?: string | null; googleReviewUrl?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const placeId = body.googlePlaceId?.trim() || null;
  const reviewUrl = body.googleReviewUrl?.trim() || null;
  if (reviewUrl && !/^https?:\/\//i.test(reviewUrl)) {
    return NextResponse.json({ error: "enlace_invalido" }, { status: 400 });
  }

  await getDb()
    .update(teams)
    .set({ googlePlaceId: placeId, googleReviewUrl: reviewUrl, updatedAt: new Date() })
    .where(eq(teams.id, g.team.id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "resenas.configurar",
    entidad: "teams",
    entidadId: g.team.id,
    payload: { conPlaceId: Boolean(placeId), conUrl: Boolean(reviewUrl) },
  });

  return NextResponse.json({ ok: true, googlePlaceId: placeId, googleReviewUrl: reviewUrl });
}
