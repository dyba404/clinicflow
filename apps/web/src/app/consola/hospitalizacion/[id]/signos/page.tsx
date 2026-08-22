import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Activity, ArrowLeft, Lock } from "lucide-react";
import { hasPermission } from "@clinicflow/core";
import { and, desc, eq } from "drizzle-orm";
import {
  getDb,
  admissions,
  patients,
  users,
  vitalSigns,
} from "@clinicflow/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/console/empty-state";
import { PageHeader } from "@/components/console/page-header";
import { SignosForm } from "@/components/console/signos-form";
import { getSession } from "@/lib/auth";
import { getDefaultTeam } from "@/lib/console-data";

export const dynamic = "force-dynamic";

const TURNO_LABEL: Record<string, string> = {
  manana: "Mañana",
  tarde: "Tarde",
  noche: "Noche",
};

const TURNO_BADGE: Record<string, "amber" | "blue" | "violet"> = {
  manana: "amber",
  tarde: "blue",
  noche: "violet",
};

export default async function SignosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "hospital.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Signos vitales" />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo el personal con permisos de hospitalización puede ver los signos vitales."
          />
        </Card>
      </div>
    );
  }

  const db = getDb();
  const [admision] = await db
    .select({
      id: admissions.id,
      motivo: admissions.motivo,
      nombrePaciente: patients.nombre,
    })
    .from(admissions)
    .innerJoin(patients, eq(admissions.patientId, patients.id))
    .where(and(eq(admissions.id, id), eq(admissions.tenantId, team.id)))
    .limit(1);

  if (!admision) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Signos vitales" />
        <Card>
          <EmptyState
            icon={Activity}
            title="Admisión no encontrada"
            description="La admisión no existe o no pertenece a esta clínica."
            action={
              <Link
                href="/consola/hospitalizacion"
                className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Volver a hospitalización
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const signos = await db
    .select({
      id: vitalSigns.id,
      turno: vitalSigns.turno,
      paSistolica: vitalSigns.paSistolica,
      paDiastolica: vitalSigns.paDiastolica,
      temperatura: vitalSigns.temperatura,
      fc: vitalSigns.fc,
      fr: vitalSigns.fr,
      spo2: vitalSigns.spo2,
      nota: vitalSigns.nota,
      nombreRegistrado: users.name,
      createdAt: vitalSigns.createdAt,
    })
    .from(vitalSigns)
    .leftJoin(users, eq(vitalSigns.registradoPor, users.id))
    .where(and(eq(vitalSigns.tenantId, team.id), eq(vitalSigns.admissionId, id)))
    .orderBy(desc(vitalSigns.createdAt));

  async function refresh() {
    "use server";
    revalidatePath(`/consola/hospitalizacion/${id}/signos`);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Signos vitales"
        description={`${admision.nombrePaciente} · ${admision.motivo}`}
        action={
          <Link
            href={`/consola/hospitalizacion/${id}`}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-card px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="size-4" />
            Volver a la admisión
          </Link>
        }
      />

      <Card>
        <CardHeader className="p-5 pb-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Activity className="size-4 text-primary" />
            Registrar signos del turno
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <SignosForm admissionId={id} onSaved={refresh} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-5 pb-4">
          <CardTitle className="text-sm font-medium">Historia de signos</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-0">
          {signos.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-muted-foreground">
              Sin signos registrados todavía.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Turno</TableHead>
                  <TableHead>PA (mmHg)</TableHead>
                  <TableHead>Temp (°C)</TableHead>
                  <TableHead>FC</TableHead>
                  <TableHead>FR</TableHead>
                  <TableHead>SpO₂</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Registrado por</TableHead>
                  <TableHead>Fecha/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signos.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Badge variant={TURNO_BADGE[s.turno] ?? "gray"}>
                        {TURNO_LABEL[s.turno] ?? s.turno}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {s.paSistolica !== null && s.paDiastolica !== null
                        ? `${s.paSistolica}/${s.paDiastolica}`
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {s.temperatura !== null ? Number(s.temperatura).toFixed(1) : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{s.fc ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{s.fr ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      {s.spo2 !== null ? `${s.spo2}%` : "—"}
                    </TableCell>
                    <TableCell className="max-w-56">
                      <span className="block truncate" title={s.nota ?? ""}>
                        {s.nota ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>{s.nombreRegistrado ?? "Sistema"}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {format(s.createdAt, "d MMM yyyy, HH:mm", { locale: es })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
