import { Search, Phone, Mail, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission } from "@clinicflow/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { NuevoPacienteDialog } from "./nuevo-paciente-dialog";
import { getDefaultTeam, pacientesConStats } from "@/lib/console-data";
import { getSession } from "@/lib/auth";
import { fmtFechaRelativa } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");
  const puedeCrear = hasPermission(session.role, "patients.manage");

  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const todos = await pacientesConStats(team.id);
  const filtrados = query
    ? todos.filter(
        (p) =>
          p.nombre.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")) ||
          p.celular.includes(query),
      )
    : todos;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Pacientes"
        description={`${todos.length} fichas · búsqueda instantánea por nombre o celular`}
        action={puedeCrear ? <NuevoPacienteDialog /> : undefined}
      />

      <form action="" className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          placeholder="Buscar por nombre o celular…"
          defaultValue={query}
          className="pl-9"
        />
      </form>

      {filtrados.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={query ? `Sin resultados para “${query}”` : "Aún no hay pacientes"}
            description={
              query
                ? "Revisa la ortografía o registra un nuevo paciente."
                : "Registra el primer paciente para empezar su ficha clínica."
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((p) => {
            const visitas = Number(p.totalVisitas);
            return (
              <Link
                key={p.id}
                href={`/consola/pacientes/${p.id}`}
                className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-2xl"
              >
              <Card className="transition-colors duration-200 hover:bg-surface-hover">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={p.nombre} className="size-10 text-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.nombre}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="size-3" />
                        {p.celular}
                      </p>
                    </div>
                    {visitas > 0 ? (
                      <Badge variant="teal">{visitas} visita{visitas === 1 ? "" : "s"}</Badge>
                    ) : (
                      <Badge variant="gray">Sin citas</Badge>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs">
                    <span className="text-muted-foreground">
                      {visitas > 0 && p.ultimaVisita
                        ? `Última visita: ${fmtFechaRelativa(p.ultimaVisita)}`
                        : "Sin historial todavía"}
                    </span>
                    {p.celular2 ? (
                      <span className="flex items-center gap-1 text-muted-foreground" title="Email registrado">
                        <Mail className="size-3" />
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
