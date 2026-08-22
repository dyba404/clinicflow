import { and, eq, gt, isNull, lt, not, or, type SQL } from "drizzle-orm";
import { getDb, appointments, blockedSlots } from "@clinicflow/db";

export function normalizarHora(hora: string): string | null {
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(hora);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const s = Number(m[3] ?? "0");
  if (h > 23 || min > 59 || s > 59) return null;
  return `${m[1]}:${m[2]}:${m[3] ?? "00"}`;
}

export function horaFinDesde(horaIni: string, duracionMin: number): string | null {
  const total = Number(horaIni.slice(0, 2)) * 60 + Number(horaIni.slice(3, 5)) + duracionMin;
  if (total >= 24 * 60) return null;
  const h = Math.floor(total / 60);
  const min = total % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
}

export async function horarioOcupado(opts: {
  tenantId: string;
  fecha: string;
  horaIni: string;
  horaFin: string;
  doctorId: string;
  excluirCitaId?: string;
}): Promise<boolean> {
  const db = getDb();

  const conds: SQL[] = [
    eq(appointments.tenantId, opts.tenantId),
    eq(appointments.doctorId, opts.doctorId),
    eq(appointments.fecha, opts.fecha),
    not(eq(appointments.estado, "cancelada")),
    lt(appointments.horaIni, opts.horaFin),
    gt(appointments.horaFin, opts.horaIni),
  ];
  if (opts.excluirCitaId) conds.push(not(eq(appointments.id, opts.excluirCitaId)));

  const [choque] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(...conds))
    .limit(1);
  if (choque) return true;

  const [bloqueado] = await db
    .select({ id: blockedSlots.id })
    .from(blockedSlots)
    .where(
      and(
        eq(blockedSlots.tenantId, opts.tenantId),
        eq(blockedSlots.fecha, opts.fecha),
        or(isNull(blockedSlots.doctorId), eq(blockedSlots.doctorId, opts.doctorId)),
        lt(blockedSlots.horaIni, opts.horaFin),
        gt(blockedSlots.horaFin, opts.horaIni),
      ),
    )
    .limit(1);
  return Boolean(bloqueado);
}
