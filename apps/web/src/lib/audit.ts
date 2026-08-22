import { getDb, auditLogs } from "@clinicflow/db";
import type { StaffRole } from "@clinicflow/core";
import { getSession } from "@/lib/auth";
import { randomBytes } from "node:crypto";

export async function logAudit(opts: {
  tenantId: string;
  usuarioId?: string | null;
  rol?: StaffRole | null;
  accion: string;
  entidad?: string;
  entidadId?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await getDb().insert(auditLogs).values({
      tenantId: opts.tenantId,
      userId: opts.usuarioId ?? null,
      accion: opts.accion,
      entidad: opts.entidad ?? null,
      entidadId: opts.entidadId ?? null,
      payload:
        opts.rol
          ? { ...(opts.payload ?? {}), rol: opts.rol }
          : opts.payload ?? null,
    });
  } catch {
    return;
  }
}

export async function logAuditSesion(opts: {
  tenantId: string;
  accion: string;
  entidad?: string;
  entidadId?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const s = await getSession();
  await logAudit({
    ...opts,
    usuarioId: s?.userId ?? null,
    rol: s?.role ?? null,
  });
}

export function randomHex(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}
