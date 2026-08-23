import { NextResponse } from "next/server";
import { getPatientSession } from "@/lib/patient-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getPatientSession();
  if (!s) {
    return NextResponse.json({ error: "sin_sesion" }, { status: 401 });
  }
  return NextResponse.json({
    paciente: {
      id: s.patientId,
      nombre: s.nombre,
      celular: s.celular,
      email: s.email,
    },
    clinica: { nombre: s.teamName, slug: s.teamSlug },
  });
}
