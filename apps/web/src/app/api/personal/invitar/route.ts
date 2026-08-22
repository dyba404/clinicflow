import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, invitations, memberships, users } from "@clinicflow/db";
import type { StaffRole } from "@clinicflow/core";
import { guardStaff, guardError } from "@/lib/auth";
import { randomHex } from "@/lib/audit";
import { appBaseUrl, mailConfigurado } from "@/lib/mail";
import { enviarEmailInvitacion } from "@/lib/notify";

const ROLES: StaffRole[] = ["owner", "receptionist", "assistant", "doctor"];

export async function GET() {
  const g = await guardStaff("staff.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const rows = await getDb()
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(eq(invitations.teamId, g.team.id))
    .orderBy(desc(invitations.createdAt));
  return NextResponse.json({ invitaciones: rows });
}

export async function POST(req: Request) {
  const g = await guardStaff("staff.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { email?: string; role?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const role = (body.role ?? "receptionist") as StaffRole;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "email_invalido" }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "rol_desconocido" }, { status: 400 });
  }

  const db = getDb();

  const [membro] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(
      and(
        eq(memberships.teamId, g.team.id),
        eq(users.email, email),
        eq(memberships.active, true),
      ),
    )
    .limit(1);
  if (membro) {
    return NextResponse.json({ error: "ya_es_miembro" }, { status: 409 });
  }

  const [pendiente] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(and(eq(invitations.teamId, g.team.id), eq(invitations.email, email)))
    .limit(1);
  if (pendiente) {
    await db.delete(invitations).where(eq(invitations.id, pendiente.id));
  }

  const token = randomHex(24);
  const [row] = await db
    .insert(invitations)
    .values({
      teamId: g.team.id,
      email,
      role,
      token,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      invitedBy: g.user.id,
    })
    .returning({ id: invitations.id });

  let emailEnviado = false;
  let emailError: string | undefined;
  if (mailConfigurado()) {
    const r = await enviarEmailInvitacion({
      to: email,
      invitadoPor: g.user.name,
      clinicaNombre: g.team.name,
      role,
      inviteUrl: `${appBaseUrl()}/invitaciones/${token}`,
    });
    emailEnviado = r.ok;
    emailError = r.ok ? undefined : r.reason;
  }

  return NextResponse.json(
    {
      ok: true,
      id: row!.id,
      token,
      emailEnviado,
      emailError: emailEnviado ? undefined : emailError ?? "email_no_configurado",
    },
    { status: 201 },
  );
}
