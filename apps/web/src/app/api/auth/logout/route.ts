import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, destroySession, getSession } from "@/lib/auth";

export async function POST() {
  const s = await getSession();
  if (s) await destroySession(s.sessionToken);
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
