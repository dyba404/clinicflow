import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const s = await getSession();
  if (s) redirect("/consola");
  return <LoginForm />;
}
