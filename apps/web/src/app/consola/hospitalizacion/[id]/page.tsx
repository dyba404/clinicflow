import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BedDouble } from "lucide-react";
import { hasPermission } from "@clinicflow/core";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import {
  getDb,
  admissionDeposits,
  admissionHandovers,
  admissions,
  bedAssignments,
  beds,
  evolutions,
  invoices,
  memberships,
  patients,
  users,
} from "@clinicflow/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { getSession } from "@/lib/auth";
import { AdmisionDetalle } from "./admision-detalle";
import { DepositosCard } from "./depositos-card";
import { HandoverCard } from "./handover-card";

export const dynamic = "force-dynamic";

export default async function AdmisionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "hospital.manage")) {
    redirect("/consola/hospitalizacion");
  }

  const db = getDb();
  const [admision] = await db
    .select({
      id: admissions.id,
      tipo: admissions.tipo,
      motivo: admissions.motivo,
      estado: admissions.estado,
      admittedAt: admissions.admittedAt,
      dischargedAt: admissions.dischargedAt,
      altaTipo: admissions.altaTipo,
      epicrisis: admissions.epicrisis,
      nombrePaciente: patients.nombre,
      doctorNombre: users.name,
    })
    .from(admissions)
    .innerJoin(patients, eq(admissions.patientId, patients.id))
    .leftJoin(users, eq(admissions.admittedById, users.id))
    .where(and(eq(admissions.id, id), eq(admissions.tenantId, session.teamId)))
    .limit(1);

  if (!admision) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Admisión" />
        <Card>
          <EmptyState
            icon={BedDouble}
            title="Admisión no encontrada"
            description="La admisión no existe o pertenece a otra clínica."
            action={
              <Link
                href="/consola/hospitalizacion"
                className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Volver al panel
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const [camaActual] = await db
    .select({ nombre: beds.nombre, area: beds.area, tipo: beds.tipo })
    .from(bedAssignments)
    .innerJoin(beds, eq(bedAssignments.bedId, beds.id))
    .where(and(eq(bedAssignments.admissionId, id), isNull(bedAssignments.hasta)))
    .limit(1);

  const filasCamas = await db
    .select({ id: beds.id, nombre: beds.nombre, area: beds.area, tipo: beds.tipo })
    .from(beds)
    .where(and(eq(beds.tenantId, session.teamId), eq(beds.estado, "libre")))
    .orderBy(beds.nombre);

  const filasEvoluciones = await db
    .select({
      id: evolutions.id,
      fecha: evolutions.fecha,
      nota: evolutions.nota,
      nombreDoctor: users.name,
      createdAt: evolutions.createdAt,
    })
    .from(evolutions)
    .leftJoin(memberships, eq(evolutions.doctorMembershipId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(eq(evolutions.admissionId, id))
    .orderBy(desc(evolutions.fecha), desc(evolutions.createdAt));

  const filasFacturas = await db
    .select({
      id: invoices.id,
      total: invoices.total,
      estado: invoices.estado,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, session.teamId),
        eq(invoices.admissionId, id),
        ne(invoices.estado, "anulada"),
      ),
    );

  const filasDepositos = await db
    .select({
      id: admissionDeposits.id,
      monto: admissionDeposits.monto,
      metodo: admissionDeposits.metodo,
      referencia: admissionDeposits.referencia,
      nota: admissionDeposits.nota,
      anuladoAt: admissionDeposits.anuladoAt,
      nombreRegistro: users.name,
      createdAt: admissionDeposits.createdAt,
    })
    .from(admissionDeposits)
    .leftJoin(users, eq(admissionDeposits.registradoPor, users.id))
    .where(
      and(eq(admissionDeposits.tenantId, session.teamId), eq(admissionDeposits.admissionId, id)),
    )
    .orderBy(desc(admissionDeposits.createdAt));

  const entregaU = alias(users, "handover_entrega_u");
  const recibeU = alias(users, "handover_recibe_u");
  const filasHandovers = await db
    .select({
      id: admissionHandovers.id,
      turno: admissionHandovers.turno,
      resumen: admissionHandovers.resumen,
      pendientes: admissionHandovers.pendientes,
      nombreEntrega: entregaU.name,
      nombreRecibe: recibeU.name,
      createdAt: admissionHandovers.createdAt,
    })
    .from(admissionHandovers)
    .leftJoin(entregaU, eq(admissionHandovers.entregaUserId, entregaU.id))
    .leftJoin(recibeU, eq(admissionHandovers.recibeUserId, recibeU.id))
    .where(
      and(
        eq(admissionHandovers.tenantId, session.teamId),
        eq(admissionHandovers.admissionId, id),
      ),
    )
    .orderBy(desc(admissionHandovers.createdAt));

  const filasMiembros = await db
    .select({ userId: users.id, name: users.name })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(memberships.teamId, session.teamId), eq(memberships.active, true)))
    .orderBy(users.name);

  const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const facturado = redondear(filasFacturas.reduce((acc, f) => acc + Number(f.total), 0));
  const depositado = redondear(
    filasDepositos
      .filter((d) => !d.anuladoAt)
      .reduce((acc, d) => acc + Number(d.monto), 0),
  );
  const saldo = redondear(facturado - depositado);

  const detalle = {
    id: admision.id,
    nombrePaciente: admision.nombrePaciente,
    tipo: admision.tipo,
    motivo: admision.motivo,
    estado: admision.estado,
    admitidaEl: format(admision.admittedAt, "d MMM yyyy, HH:mm", { locale: es }),
    dischargedAt: admision.dischargedAt
      ? format(admision.dischargedAt, "d MMM yyyy, HH:mm", { locale: es })
      : null,
    altaTipo: admision.altaTipo,
    epicrisis: admision.epicrisis,
    doctorNombre: admision.doctorNombre,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={`Admisión · ${admision.nombrePaciente}`}
        description="Detalle de la admisión: cama, evoluciones y alta."
        action={
          <Link
            href={`/consola/hospitalizacion/${id}/signos`}
            className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Signos vitales
          </Link>
        }
      />
      <AdmisionDetalle
        admision={detalle}
        cama={camaActual ?? null}
        camasLibres={filasCamas}
        evoluciones={filasEvoluciones.map((e) => ({
          id: e.id,
          fecha: e.fecha,
          nota: e.nota,
          nombreDoctor: e.nombreDoctor ?? null,
        }))}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <DepositosCard
          admissionId={admision.id}
          activa={admision.estado === "activa"}
          depositos={filasDepositos.map((d) => ({
            id: d.id,
            montoNum: Number(d.monto),
            metodo: d.metodo,
            referencia: d.referencia,
            nota: d.nota,
            anuladoAt: d.anuladoAt ? format(d.anuladoAt, "d MMM yyyy, HH:mm", { locale: es }) : null,
            nombreRegistro: d.nombreRegistro,
            createdAt: format(d.createdAt, "d MMM yyyy, HH:mm", { locale: es }),
          }))}
          facturas={filasFacturas.map((f) => ({
            id: f.id,
            totalNum: Number(f.total),
            estado: f.estado,
          }))}
          facturado={facturado}
          depositado={depositado}
          saldo={saldo}
        />
        <HandoverCard
          admissionId={admision.id}
          activa={admision.estado === "activa"}
          handovers={filasHandovers.map((h) => ({
            id: h.id,
            turno: h.turno,
            resumen: h.resumen,
            pendientes: h.pendientes,
            nombreEntrega: h.nombreEntrega,
            nombreRecibe: h.nombreRecibe,
            createdAt: format(h.createdAt, "d MMM yyyy, HH:mm", { locale: es }),
          }))}
          miembros={filasMiembros}
        />
      </div>
    </div>
  );
}
