import { redirect } from "next/navigation";
import { getSession, getPlatformSession } from "@/lib/auth";
import { PrimerAccesoForm } from "./primer-acceso-form";

export const dynamic = "force-dynamic";

export default async function PrimerAccesoPage() {
  const staff = await getSession();
  const platform = staff ? null : await getPlatformSession();
  if (!staff && !platform) redirect("/login");

  const mustChange = staff?.mustChangePassword ?? platform?.mustChangePassword;
  const destino = staff ? "/consola" : "/admin";
  if (!mustChange) redirect(destino);

  return <PrimerAccesoForm destino={destino} />;
}
