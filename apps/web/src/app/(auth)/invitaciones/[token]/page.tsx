import { getDb, invitations, teams } from "@clinicflow/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AceptarInvitacionForm } from "./invitacion-form";

export const dynamic = "force-dynamic";

export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();

  const [inv] = await db
    .select({
      token: invitations.token,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      clinicaNombre: teams.name,
    })
    .from(invitations)
    .innerJoin(teams, eq(invitations.teamId, teams.id))
    .where(eq(invitations.token, token))
    .limit(1);

  if (!inv || inv.expiresAt < new Date()) notFound();

  return (
    <AceptarInvitacionForm
      token={inv.token}
      email={inv.email}
      role={inv.role}
      clinicaNombre={inv.clinicaNombre}
    />
  );
}
