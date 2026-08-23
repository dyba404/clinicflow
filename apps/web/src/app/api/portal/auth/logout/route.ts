import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  destroyPatientSession,
  getPatientSession,
  PATIENT_SESSION_COOKIE,
} from "@/lib/patient-auth";

export async function POST() {
  const s = await getPatientSession();
  if (s) {
    await destroyPatientSession(s.sessionToken);
  }
  const store = await cookies();
  store.delete(PATIENT_SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
