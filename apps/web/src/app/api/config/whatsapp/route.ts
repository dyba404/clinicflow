import { NextResponse } from "next/server";
import { eq, isNotNull } from "drizzle-orm";
import { getDb, whatsappSettings } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";
import { masterKeyConfigurada, cifrar } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardStaff("services.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const [fila] = await getDb()
    .select({
      activo: whatsappSettings.activo,
      phoneNumberId: whatsappSettings.phoneNumberId,
      tokenEnc: whatsappSettings.tokenEnc,
      webhookVerifiedAt: whatsappSettings.webhookVerifiedAt,
    })
    .from(whatsappSettings)
    .where(eq(whatsappSettings.tenantId, g.team.id))
    .limit(1);

  return NextResponse.json({
    activo: fila?.activo ?? false,
    phoneNumberId: fila?.phoneNumberId ?? null,
    configurado: Boolean(fila?.activo && fila.phoneNumberId && fila.tokenEnc),
    webhookVerifiedAt: fila?.webhookVerifiedAt?.toISOString() ?? null,
  });
}

export async function PUT(req: Request) {
  const g = await guardStaff("services.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  if (!masterKeyConfigurada()) {
    return NextResponse.json({ error: "master_key_no_configurada" }, { status: 503 });
  }

  let body: { phoneNumberId?: string | null; token?: string | null; activo?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const phoneNumberId = body.phoneNumberId?.trim() || null;
  const activo = body.activo ?? false;
  const token = body.token?.trim() || null;
  if (activo && (!phoneNumberId || !token)) {
    return NextResponse.json({ error: "datos_incompletos" }, { status: 400 });
  }

  const db = getDb();
  const values: {
    tenantId: string;
    phoneNumberId: string | null;
    tokenEnc: string | null;
    activo: boolean;
    updatedAt: Date;
  } = {
    tenantId: g.team.id,
    phoneNumberId,
    tokenEnc: token ? cifrar(token) : null,
    activo,
    updatedAt: new Date(),
  };

  await db
    .insert(whatsappSettings)
    .values(values)
    .onConflictDoUpdate({
      target: whatsappSettings.tenantId,
      set: {
        phoneNumberId,
        tokenEnc: token ? values.tokenEnc : undefined,
        activo,
        updatedAt: new Date(),
      },
    });

  if (activo && phoneNumberId) {
    const [recien] = await db
      .select({
        tokenEnc: whatsappSettings.tokenEnc,
        webhookVerifiedAt: whatsappSettings.webhookVerifiedAt,
      })
      .from(whatsappSettings)
      .where(eq(whatsappSettings.tenantId, g.team.id))
      .limit(1);
    if (recien?.tokenEnc && !recien.webhookVerifiedAt) {
      const [verificadoGlobal] = await db
        .select({ id: whatsappSettings.tenantId })
        .from(whatsappSettings)
        .where(isNotNull(whatsappSettings.webhookVerifiedAt))
        .limit(1);
      if (verificadoGlobal) {
        await db
          .update(whatsappSettings)
          .set({ webhookVerifiedAt: new Date(), updatedAt: new Date() })
          .where(eq(whatsappSettings.tenantId, g.team.id));
      }
    }
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "whatsapp.configurar",
    entidad: "whatsapp_settings",
    entidadId: g.team.id,
    payload: { activo, tokenActualizado: Boolean(token) },
  });

  return NextResponse.json({ ok: true });
}
