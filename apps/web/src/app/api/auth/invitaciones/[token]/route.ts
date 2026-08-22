import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, invitations, teams } from "@clinicflow/db";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();

  const [inv] = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      clinicaNombre: teams.name,
    })
    .from(invitations)
    .innerJoin(teams, eq(invitations.teamId, teams.id))
    .where(eq(invitations.token, token))
    .limit(1);

  if (!inv) {
    return NextResponse.json({ error: "invitacion_no_encontrada" }, { status: 404 });
  }
  if (inv.expiresAt < new Date()) {
    return NextResponse.json({ error: "invitacion_expirada" }, { status: 410 });
  }

  return NextResponse.json({
    email: inv.email,
    role: inv.role,
    clinicaNombre: inv.clinicaNombre,
  });
}
