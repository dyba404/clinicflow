import { getPlatformSession, getSession } from "@/lib/auth";

export async function isAdmin(): Promise<boolean> {
  const tenantSession = await getSession();
  if (tenantSession?.isPlatformAdmin) return true;
  return (await getPlatformSession()) !== null;
}
