import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, teams, memberships, users, sessions } from "@clinicflow/db";
import { ipReq } from "@/lib/rate-limit";
import { adminGuard } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await adminGuard("miembros", ipReq(req));
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const db = getDb();
  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, id)).limit(1);
  if (!team) return NextResponse.json({ error: "tenant_no_encontrado" }, { status: 404 });

  const rows = await db
    .select({
      membershipId: memberships.id,
      active: memberships.active,
      role: memberships.role,
      userId: users.id,
      name: users.name,
      email: users.email,
      lockedAt: users.lockedAt,
      isPlatformAdmin: users.isPlatformAdmin,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.teamId, id))
    .orderBy(desc(memberships.createdAt));

  const ultimaSesion = new Map<string, Date | null>();
  for (const r of rows) {
    if (!ultimaSesion.has(r.userId)) ultimaSesion.set(r.userId, null);
  }
  const sesRows = await db
    .select({ userId: sessions.userId, createdAt: sessions.createdAt })
    .from(sessions)
    .where(eq(sessions.tenantId, id))
    .orderBy(desc(sessions.createdAt));
  for (const s of sesRows) {
    if (ultimaSesion.get(s.userId) == null) ultimaSesion.set(s.userId, s.createdAt);
  }

  const miembros = rows.map((r) => ({
    membershipId: r.membershipId,
    userId: r.userId,
    name: r.name,
    email: r.email,
    role: r.role,
    active: r.active,
    lockedAt: r.lockedAt,
    isPlatformAdmin: r.isPlatformAdmin,
    ultimaSesion: ultimaSesion.get(r.userId) ?? null,
  }));

  return NextResponse.json({ ok: true, miembros });
}
