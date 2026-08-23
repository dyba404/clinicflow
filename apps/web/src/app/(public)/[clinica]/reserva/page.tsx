import { getTenantBySlug, listActiveServices, listDoctors } from "@/lib/db";
import { notFound } from "next/navigation";
import { WizardReserva } from "./wizard";

export const dynamic = "force-dynamic";

export default async function ReservaPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ clinica: string }>;
  searchParams: Promise<{ nombre?: string; celular?: string }>;
}>) {
  const { clinica } = await params;
  const sp = await searchParams;
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
      prefillNombre={sp.nombre?.trim() || undefined}
      prefillCelular={sp.celular?.trim() || undefined}
    />
  );
}
