import { redirect } from "next/navigation";
import { getTenantBySlug } from "@/lib/db";
import { getPatientSession } from "@/lib/patient-auth";
import { PortalLogin } from "./login-form";

export const dynamic = "force-dynamic";

export default async function PortalEntryPage({
  params,
}: {
  params: Promise<{ clinica: string }>;
}) {
  const { clinica } = await params;
  const tenant = await getTenantBySlug(clinica);
  if (!tenant) redirect("/");

  const session = await getPatientSession();
  if (session && session.teamSlug === clinica) {
    redirect(`/${clinica}/portal/mio`);
  }

  return <PortalLogin clinica={clinica} clinicaNombre={tenant.name} />;
}
