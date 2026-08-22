import { NextResponse } from "next/server";
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { getDb, auditLogs, users } from "@clinicflow/db";
import { guardStaff, guardError, ROLE_INFO } from "@/lib/auth";
import type { StaffRole } from "@clinicflow/core";

export const dynamic = "force-dynamic";

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const LIMITE_FILAS = 5000;

function validaFecha(valor: string | null): string | null {
  return valor && RE_FECHA.test(valor) && !Number.isNaN(Date.parse(`${valor}T12:00:00`)) ? valor : null;
}

function csvCelda(valor: string | null | undefined): string {
  const s = valor ?? "";
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const g = await guardStaff("reports.view_all");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const url = new URL(req.url);
  const desde = validaFecha(url.searchParams.get("desde"));
  const hasta = validaFecha(url.searchParams.get("hasta"));
  const accion = url.searchParams.get("accion")?.trim() || null;
  const entidad = url.searchParams.get("entidad")?.trim() || null;
  const usuario = url.searchParams.get("usuario")?.trim() || null;

  const condiciones = [eq(auditLogs.tenantId, g.team.id)];
  if (desde) condiciones.push(gte(auditLogs.createdAt, new Date(`${desde}T00:00:00-05:00`)));
  if (hasta) condiciones.push(lte(auditLogs.createdAt, new Date(`${hasta}T23:59:59.999-05:00`)));
  if (accion) condiciones.push(eq(auditLogs.accion, accion));
  if (entidad) condiciones.push(eq(auditLogs.entidad, entidad));
  if (usuario === "Sistema") condiciones.push(isNull(auditLogs.userId));
  else if (usuario) condiciones.push(eq(users.name, usuario));

  const filas = await getDb()
    .select({
      accion: auditLogs.accion,
      entidad: auditLogs.entidad,
      entidadId: auditLogs.entidadId,
      payload: auditLogs.payload,
      createdAt: auditLogs.createdAt,
      userName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(and(...condiciones))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(LIMITE_FILAS);

  const formatoLima = new Intl.DateTimeFormat("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: g.team.timezone || "America/Lima",
  });

  const lineas = [
    ["Acción", "Detalle", "Rol", "Usuario", "Momento"].join(","),
    ...filas.map((f) => {
      const rolLog = (f.payload as { rol?: string } | null)?.rol;
      const rolLabel =
        rolLog && rolLog in ROLE_INFO ? ROLE_INFO[rolLog as StaffRole].label : (rolLog ?? "—");
      const detalle = f.entidad
        ? f.entidadId
          ? `${f.entidad} · ${f.entidadId.slice(0, 8)}…`
          : f.entidad
        : "—";
      return [
        csvCelda(f.accion),
        csvCelda(detalle),
        csvCelda(rolLabel),
        csvCelda(f.userName ?? "Sistema"),
        csvCelda(formatoLima.format(f.createdAt)),
      ].join(",");
    }),
  ].join("\r\n");

  return new Response(`\uFEFF${lineas}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="auditoria.csv"',
    },
  });
}
