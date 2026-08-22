import { NextResponse } from "next/server";
import { legalRenderizadoPorSlug } from "@/lib/legal";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clinica: string }> },
) {
  const { clinica } = await params;
  const legal = await legalRenderizadoPorSlug(clinica);
  if (!legal) {
    return NextResponse.json({ error: "clinica_no_encontrada" }, { status: 404 });
  }
  return NextResponse.json(
    {
      clinica: { nombre: legal.nombreClinica, slug: legal.slug },
      responsable: {
        razonSocial: legal.razonSocial,
        ruc: legal.ruc,
        direccion: legal.direccionLegal,
        email: legal.email,
        telefono: legal.telefono,
      },
      politicaPrivacidad: legal.privacidad,
      terminosUso: legal.terminos,
      consentimiento: legal.consentimiento,
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
