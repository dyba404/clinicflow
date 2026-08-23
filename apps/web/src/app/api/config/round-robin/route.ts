import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, teams } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardStaff("staff.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const [team] = await getDb()
    .select({ roundRobin: teams.roundRobin })
    .from(teams)
    .where(eq(teams.id, g.team.id))
    .limit(1);

  return NextResponse.json({ roundRobin: team?.roundRobin ?? false });
}

export async function PUT(req: Request) {
  const g = await guardStaff("staff.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { roundRobin?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const roundRobin = Boolean(body.roundRobin);

  await getDb()
    .update(teams)
    .set({ roundRobin, updatedAt: new Date() })
    .where(eq(teams.id, g.team.id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "personal.round_robin",
    entidad: "teams",
    entidadId: g.team.id,
    payload: { roundRobin },
  });

  return NextResponse.json({ ok: true, roundRobin });
}
