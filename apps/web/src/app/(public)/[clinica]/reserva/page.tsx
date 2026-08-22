import { getTenantBySlug, listActiveServices, listDoctors } from "@/lib/db";
import { notFound } from "next/navigation";
import { WizardReserva } from "./wizard";

export const dynamic = "force-dynamic";

export default async function ReservaPage({
  params,
}: Readonly<{ params: Promise<{ clinica: string }> }>) {
  const { clinica } = await params;
  const tenant = await getTenantBySlug(clinica);
  if (!tenant) notFound();

  const [servicios, doctores] = await Promise.all([
    listActiveServices(tenant.teamId),
    listDoctors(tenant.teamId),
  ]);

  return (
    <WizardReserva
      clinicaSlug={tenant.slug}
      clinicaName={tenant.name}
      servicios={servicios.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        duracionMin: s.duracionMin,
        precio: s.precio,
      }))}
      doctores={doctores}
    />
  );
}
