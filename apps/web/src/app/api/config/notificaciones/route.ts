import { NextResponse } from "next/server";
import { getDb, notificationSettings } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export async function POST(req: Request) {
  const g = await guardStaff("services.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    recordatorio24h?: boolean;
    confirmacionSolicitud?: boolean;
    plantillaRecordatorio?: string;
    idiomaPlantilla?: string;
    resenaAutomatica?: boolean;
    recallAuto?: boolean;
    noShowRecovery?: boolean;
    digestDiario?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const updates: {
    recordatorio24h?: boolean;
    confirmacionSolicitud?: boolean;
    plantillaRecordatorio?: string;
    idiomaPlantilla?: string;
    resenaAutomatica?: boolean;
    recallAuto?: boolean;
    noShowRecovery?: boolean;
    digestDiario?: boolean;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (typeof body.recordatorio24h === "boolean") updates.recordatorio24h = body.recordatorio24h;
  if (typeof body.confirmacionSolicitud === "boolean") {
    updates.confirmacionSolicitud = body.confirmacionSolicitud;
  }
  if (typeof body.plantillaRecordatorio === "string" && body.plantillaRecordatorio.trim()) {
    updates.plantillaRecordatorio = body.plantillaRecordatorio.trim();
  }
  if (typeof body.idiomaPlantilla === "string" && body.idiomaPlantilla.trim()) {
    updates.idiomaPlantilla = body.idiomaPlantilla.trim();
  }
  if (typeof body.resenaAutomatica === "boolean") updates.resenaAutomatica = body.resenaAutomatica;
  if (typeof body.recallAuto === "boolean") updates.recallAuto = body.recallAuto;
  if (typeof body.noShowRecovery === "boolean") updates.noShowRecovery = body.noShowRecovery;
  if (typeof body.digestDiario === "boolean") updates.digestDiario = body.digestDiario;

  const db = getDb();
  await db
    .insert(notificationSettings)
    .values({ tenantId: g.team.id, ...updates })
    .onConflictDoUpdate({
      target: notificationSettings.tenantId,
      set: updates,
    });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "notificaciones.configurar",
    entidad: "notification_settings",
    payload: { recordatorio24h: updates.recordatorio24h, confirmacion: updates.confirmacionSolicitud },
  });

  return NextResponse.json({ ok: true });
}
