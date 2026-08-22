import { redirect } from "next/navigation";
import {
  getSession,
  getPlatformSession,
  type SessionUser,
  type PlatformSessionUser,
} from "@/lib/auth";

export async function requireStaffSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/primer-acceso");
  return session;
}

export async function requirePlatformSession(): Promise<PlatformSessionUser> {
  const session = await getPlatformSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/primer-acceso");
  return session;
}
