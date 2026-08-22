import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const s = await getSession();
  if (s) redirect("/consola");
  return <SignupForm />;
}
