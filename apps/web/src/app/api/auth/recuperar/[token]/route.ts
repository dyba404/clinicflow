import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, passwordResets, users } from "@clinicflow/db";
import { hashPassword } from "@/lib/auth";
import { rateLimit, ipReq } from "@/lib/rate-limit";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const limite = rateLimit(`recuperar-confirmar:${ipReq(req)}`, 10);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  let body: { password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const password = body.password ?? "";
  if (password.length < 8) {
    return NextResponse.json({ error: "password_corta" }, { status: 400 });
  }

  const db = getDb();
  const [reset] = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.token, token), isNull(passwordResets.usedAt)))
    .limit(1);
  if (!reset || reset.expiresAt < new Date()) {
    return NextResponse.json({ error: "token_invalido" }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, reset.userId)).limit(1);
  if (!user || user.lockedAt) {
    return NextResponse.json({ error: "token_invalido" }, { status: 400 });
  }

  const hash = await hashPassword(password);
  await db.update(users).set({ passwordHash: hash }).where(eq(users.id, reset.userId));
  await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(eq(passwordResets.id, reset.id));

  return NextResponse.json({ ok: true });
}
