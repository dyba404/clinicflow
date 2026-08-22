import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import {
  getDb,
  users,
  teams,
  memberships,
  subscriptions,
  notificationSettings,
} from "@clinicflow/db";
import { hashPassword, createSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { rateLimit, ipReq } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const limite = rateLimit(`signup:${ipReq(req)}`, 5);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  let body: {
    clinica?: string;
    slug?: string;
    nombre?: string;
    email?: string;
    password?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const clinica = body.clinica?.trim();
  const nombre = body.nombre?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!clinica || clinica.length < 3 || clinica.length > 60) {
    return NextResponse.json({ error: "clinica_invalida" }, { status: 400 });
  }
  if (!nombre || nombre.length < 3 || nombre.length > 60) {
    return NextResponse.json({ error: "nombre_invalido" }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "email_invalido" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password_corta" }, { status: 400 });
  }

  const slug = (body.slug?.trim() || slugify(clinica)).toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
    return NextResponse.json({ error: "slug_invalido" }, { status: 400 });
  }

  const db = getDb();

  const [userExiste] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (userExiste) {
    return NextResponse.json({ error: "email_ya_registrado" }, { status: 409 });
  }

  const [slugExiste] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.slug, slug))
    .limit(1);
  if (slugExiste) {
    return NextResponse.json({ error: "slug_ocupado" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const [team] = await db
    .insert(teams)
    .values({
      name: clinica,
      slug,
      timezone: "America/Lima",
      bookingMode: "solicitud",
    })
    .returning();
  if (!team) {
    return NextResponse.json({ error: "no_se_pudo_crear_clinica" }, { status: 500 });
  }

  const [user] = await db
    .insert(users)
    .values({ name: nombre, email, passwordHash, emailVerifiedAt: new Date() })
    .returning();
  if (!user) {
    return NextResponse.json({ error: "no_se_pudo_crear_usuario" }, { status: 500 });
  }

  const [membership] = await db
    .insert(memberships)
    .values({ teamId: team.id, userId: user.id, role: "owner" })
    .returning();

  await db.insert(subscriptions).values({ tenantId: team.id, plan: "free", estado: "activo" });
  await db.insert(notificationSettings).values({ tenantId: team.id });

  void logAudit({
    tenantId: team.id,
    usuarioId: user.id,
    rol: "owner",
    accion: "clinica.crear",
    entidad: "teams",
    entidadId: team.id,
  });

  const { token } = await createSession({
    userId: user.id,
    tenantId: team.id,
    membershipId: membership!.id,
    userAgent: req.headers.get("user-agent"),
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ ok: true, slug: team.slug }, { status: 201 });
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
