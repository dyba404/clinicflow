import { redirect } from "next/navigation";
import { getTenantBySlug } from "@/lib/db";
import { ActivarPortal } from "./activar-form";

export const dynamic = "force-dynamic";

export default async function ActivarPortalPage({
  params,
}: {
  params: Promise<{ clinica: string; token: string }>;
}) {
  const { clinica, token } = await params;
  const tenant = await getTenantBySlug(clinica);
  if (!tenant) redirect("/");

  return <ActivarPortal clinica={clinica} clinicaNombre={tenant.name} token={token} />;
}
