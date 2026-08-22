import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { History, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, desc, eq, gte, isNotNull, isNull, lte, type SQL } from "drizzle-orm";
import { hasPermission, type StaffRole } from "@clinicflow/core";
import { auditLogs, getDb, users } from "@clinicflow/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSession, ROLE_INFO } from "@/lib/auth";
import { getDefaultTeam } from "@/lib/console-data";

export const dynamic = "force-dynamic";

const LIMITE = 50;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

type FiltrosAuditoria = {
  desde: string | null;
  hasta: string | null;
  accion: string | null;
  entidad: string | null;
  usuario: string | null;
  offset: number;
};

function fechaValida(valor: string | undefined): string | null {
  return valor && RE_FECHA.test(valor) && !Number.isNaN(Date.parse(`${valor}T12:00:00`))
    ? valor
    : null;
}

function parseFiltros(sp: {
  desde?: string;
  hasta?: string;
  accion?: string;
  entidad?: string;
  usuario?: string;
  offset?: string;
}): FiltrosAuditoria {
  const offsetRaw = Number(sp.offset ?? "0");
  return {
    desde: fechaValida(sp.desde),
    hasta: fechaValida(sp.hasta),
    accion: sp.accion?.trim() ? sp.accion.trim() : null,
    entidad: sp.entidad?.trim() ? sp.entidad.trim() : null,
    usuario: sp.usuario?.trim() ? sp.usuario.trim() : null,
    offset: Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0,
  };
}

function condiciones(tenantId: string, f: FiltrosAuditoria): SQL[] {
  const lista: SQL[] = [eq(auditLogs.tenantId, tenantId)];
  if (f.desde) lista.push(gte(auditLogs.createdAt, new Date(`${f.desde}T00:00:00-05:00`)));
  if (f.hasta) lista.push(lte(auditLogs.createdAt, new Date(`${f.hasta}T23:59:59.999-05:00`)));
  if (f.accion) lista.push(eq(auditLogs.accion, f.accion));
  if (f.entidad) lista.push(eq(auditLogs.entidad, f.entidad));
  if (f.usuario === "Sistema") lista.push(isNull(auditLogs.userId));
  else if (f.usuario) lista.push(eq(users.name, f.usuario));
  return lista;
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    accion?: string;
    entidad?: string;
    usuario?: string;
    offset?: string;
  }>;
}) {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  const rol = session.role;
  if (!hasPermission(rol, "reports.view_all")) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="Acceso restringido"
            description="Tu rol no tiene permiso para ver el registro de auditoría."
          />
        </Card>
      </div>
    );
  }

  const f = parseFiltros(await searchParams);
  const db = getDb();
  const where = and(...condiciones(team.id, f));

  const [filas, [totalRow], accionesRows, entidadesRows, usuariosRows] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        accion: auditLogs.accion,
        entidad: auditLogs.entidad,
        entidadId: auditLogs.entidadId,
        payload: auditLogs.payload,
        createdAt: auditLogs.createdAt,
        userName: users.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(LIMITE)
      .offset(f.offset),
    db.select({ total: count() }).from(auditLogs).where(eq(auditLogs.tenantId, team.id)),
    db.selectDistinct({ accion: auditLogs.accion }).from(auditLogs).where(eq(auditLogs.tenantId, team.id)).limit(200),
    db
      .selectDistinct({ entidad: auditLogs.entidad })
      .from(auditLogs)
      .where(and(eq(auditLogs.tenantId, team.id), isNotNull(auditLogs.entidad)))
      .limit(200),
    db
      .selectDistinct({ usuario: users.name })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.userId, users.id))
      .where(eq(auditLogs.tenantId, team.id))
      .limit(200),
  ]);

  const total = totalRow?.total ?? 0;
  const filtrado = Boolean(f.desde || f.hasta || f.accion || f.entidad || f.usuario);
  const anterior = f.offset - LIMITE >= 0 ? f.offset - LIMITE : null;
  const siguiente = f.offset + LIMITE < total ? f.offset + LIMITE : null;

  const hrefCon = (overrides: Record<string, string | null>) => {
    const sp = new URLSearchParams();
    const valores: Record<string, string | null> = {
      desde: f.desde,
      hasta: f.hasta,
      accion: f.accion,
      entidad: f.entidad,
      usuario: f.usuario,
      ...overrides,
    };
    for (const [k, v] of Object.entries(valores)) {
      if (v) sp.set(k, v);
    }
    const q = sp.toString();
    return q ? `/consola/auditoria?${q}` : "/consola/auditoria";
  };
  const hrefExport = hrefCon({});
  const exportUrl = `/api/auditoria/export${hrefExport.includes("?") ? `?${hrefExport.split("?")[1]}` : ""}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Auditoría"
        description="Registro automático de acciones clave del equipo."
        action={
          <a
            href={exportUrl}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Exportar CSV
          </a>
        }
      />

      <form key={hrefExport} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" type="date" name="desde" defaultValue={f.desde ?? ""} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" type="date" name="hasta" defaultValue={f.hasta ?? ""} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="accion">Acción</Label>
          <select
            id="accion"
            name="accion"
            defaultValue={f.accion ?? ""}
            className="flex h-9 w-44 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todas</option>
            {accionesRows
              .map((r) => r.accion)
              .sort((a, b) => a.localeCompare(b, "es"))
              .map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="entidad">Entidad</Label>
          <select
            id="entidad"
            name="entidad"
            defaultValue={f.entidad ?? ""}
            className="flex h-9 w-40 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todas</option>
            {entidadesRows
              .map((r) => r.entidad)
              .filter((e): e is string => Boolean(e))
              .sort((a, b) => a.localeCompare(b, "es"))
              .map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="usuario">Usuario</Label>
          <select
            id="usuario"
            name="usuario"
            defaultValue={f.usuario ?? ""}
            className="flex h-9 w-48 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todos</option>
            <option value="Sistema">Sistema</option>
            {usuariosRows
              .map((r) => r.usuario)
              .filter((u): u is string => Boolean(u))
              .sort((a, b) => a.localeCompare(b, "es"))
              .map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
          </select>
        </div>
        <div className="flex gap-2 pb-0.5">
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Filtrar
          </button>
          {filtrado ? (
            <Link
              href="/consola/auditoria"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              <X className="size-4" />
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>

      {filas.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title={filtrado ? "Sin resultados para esos filtros" : "Aún no hay actividad"}
            description={
              filtrado
                ? "Ajusta el rango de fechas o los filtros para ver más registros."
                : "Las acciones del equipo (citas, pagos, cierres…) se registran aquí automáticamente."
            }
          />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Acción</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Momento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((fila) => {
                const rolLog = (fila.payload as { rol?: string } | null)?.rol;
                const rolLabel =
                  rolLog && rolLog in ROLE_INFO
                    ? ROLE_INFO[rolLog as StaffRole].label
                    : rolLog ?? "—";
                return (
                  <TableRow key={fila.id}>
                    <TableCell>
                      <Badge variant="secondary">{fila.accion}</Badge>
                    </TableCell>
                    <TableCell>
                      {fila.entidad ? (
                        <p className="text-sm">
                          {fila.entidad}
                          {fila.entidadId ? (
                            <span className="tabular-nums text-muted-foreground">
                              {" "}
                              · {fila.entidadId.slice(0, 8)}…
                            </span>
                          ) : null}
                        </p>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{rolLabel}</TableCell>
                    <TableCell>{fila.userName ?? "Sistema"}</TableCell>
                    <TableCell className="tabular-nums">
                      <span title={`Hora exacta: ${format(fila.createdAt, "HH:mm")}`}>
                        {formatDistanceToNow(fila.createdAt, {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filtrado ? (
            <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
              Filtros aplicados: {total} registros encontrados.
            </p>
          ) : null}
          {(anterior !== null || siguiente !== null) && (
            <div className="flex items-center justify-between border-t p-3">
              <span className="text-xs tabular-nums text-muted-foreground">
                {f.offset + 1}–{Math.min(f.offset + LIMITE, total)} de {total}
              </span>
              <div className="flex gap-2">
                {anterior !== null ? (
                  <Link
                    href={hrefCon({ offset: String(anterior) })}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
                  >
                    Anteriores
                  </Link>
                ) : null}
                {siguiente !== null ? (
                  <Link
                    href={hrefCon({ offset: String(siguiente) })}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
                  >
                    Siguientes
                  </Link>
                ) : null}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
