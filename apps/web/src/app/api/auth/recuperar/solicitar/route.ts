import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, users, passwordResets } from "@clinicflow/db";
import { randomHex } from "@/lib/audit";
import { appBaseUrl, mailConfigurado } from "@/lib/mail";
import { enviarEmailPasswordReset } from "@/lib/notify";
import { rateLimit, ipReq } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const limite = rateLimit(`recuperar:${ipReq(req)}`, 5);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  let body: { email?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "email_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (user?.passwordHash && !user.lockedAt && mailConfigurado()) {
    const token = randomHex(24);
    await db.insert(passwordResets).values({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 3600_000),
    });
    await enviarEmailPasswordReset({
      to: user.email,
      nombre: user.name.split(" ")[0] ?? user.name,
      resetUrl: `${appBaseUrl()}/recuperar/${token}`,
    });
  }

  return NextResponse.json({ ok: true });
}
