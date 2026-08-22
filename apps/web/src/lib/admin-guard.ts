import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export type AdminGuardResult =
  | { ok: true; admin: { userId: string; name: string; email: string } }
  | { ok: false; response: NextResponse };

export async function adminGuard(accion: string, ip: string): Promise<AdminGuardResult> {
  const session = await getPlatformSession();
  if (!session) return { ok: false, response: NextResponse.json({ error: "sin_sesion" }, { status: 401 }) };
  if (session.mustChangePassword) {
    return { ok: false, response: NextResponse.json({ error: "debe_cambiar_contrasena" }, { status: 403 }) };
  }

  const limite = rateLimit(`admin:${accion}:${ip}`, 20);
  if (!limite.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "demasiadas_solicitudes" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
      ),
    };
  }

  return { ok: true, admin: { userId: session.userId, name: session.name, email: session.email } };
}

export function auditPayloadSoporte(adminEmail: string, extra?: Record<string, unknown>) {
  return { via: "soporte_plataforma", adminEmail, ...(extra ?? {}) };
}
