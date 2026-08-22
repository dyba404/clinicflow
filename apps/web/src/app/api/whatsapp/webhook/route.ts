import { NextResponse } from "next/server";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb, patients, whatsappMessages, whatsappSettings } from "@clinicflow/db";
import { logAudit } from "@/lib/audit";
import { normalizarCelularE164 } from "@/lib/whatsapp";
import { procesarMensajeEntrante } from "@/lib/whatsapp-entrante";
import { rateLimit, ipReq } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function verifyToken(): string {
  return process.env.WHATSAPP_VERIFY_TOKEN ?? "clinicflow-verify";
}

export async function GET(req: Request) {
  const limite = rateLimit(`wa-webhook:${ipReq(req)}`, 30);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === verifyToken() && challenge) {
    try {
      await getDb()
        .update(whatsappSettings)
        .set({ webhookVerifiedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(whatsappSettings.activo, true),
            isNotNull(whatsappSettings.phoneNumberId),
            isNotNull(whatsappSettings.tokenEnc),
          ),
        );
    } catch {
      void 0;
    }
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ error: "verificacion_invalida" }, { status: 403 });
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    const db = getDb();
    const entry = (payload as { entry?: Array<{ changes?: Array<{ value?: unknown }> }> }).entry;
    for (const e of entry ?? []) {
      for (const change of e.changes ?? []) {
        const value = change.value as {
          contacts?: Array<{ wa_id?: string }>;
          messages?: Array<{ type?: string; text?: { body?: string } }>;
        } | undefined;
        const mensajes = value?.messages ?? [];
        for (const msg of mensajes) {
          if (msg.type !== "text") continue;
          const waId = normalizarCelularE164(value?.contacts?.[0]?.wa_id) ?? "";
          const variantes = new Set([waId, waId.replace(/^00/, ""), `0${waId.slice(-9)}`]);
          if (waId.startsWith("51")) variantes.add(waId.slice(2));
          variantes.delete("");
          const [paciente] =
            variantes.size > 0
              ? await db
                  .select({ id: patients.id, tenantId: patients.tenantId, email: patients.email })
                  .from(patients)
                  .where(inArray(patients.celular, [...variantes]))
                  .limit(1)
              : [];
          if (paciente) {
            const cuerpo = (msg.text?.body ?? "").slice(0, 1000);
            await db
              .insert(whatsappMessages)
              .values({
                tenantId: paciente.tenantId,
                waId,
                direction: "in",
                patientId: paciente.id,
                phoneNumber: waId,
                body: cuerpo || null,
                estado: "recibido",
              })
              .catch(() => {});
            void logAudit({
              tenantId: paciente.tenantId,
              accion: "whatsapp.mensaje_entrante",
              entidad: "whatsapp",
              payload: { numero: waId, texto: (msg.text?.body ?? "").slice(0, 40) },
            });
            await procesarMensajeEntrante({
              tenantId: paciente.tenantId,
              patientId: paciente.id,
              patientEmail: paciente.email,
              waId,
              texto: msg.text?.body ?? "",
            }).catch(() => {});
          }
        }
      }
    }
  } catch {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
