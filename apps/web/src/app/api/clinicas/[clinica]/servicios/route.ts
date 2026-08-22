import { NextResponse } from "next/server";
import { getTenantBySlug, listActiveServices } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clinica: string }> },
) {
  const { clinica } = await params;
  const tenant = await getTenantBySlug(clinica);
  if (!tenant) {
    return NextResponse.json({ error: "clinica_no_encontrada" }, { status: 404 });
  }
  const servicios = await listActiveServices(tenant.teamId);
  return NextResponse.json({
    clinica: { name: tenant.name, slug: tenant.slug, bookingMode: tenant.bookingMode },
    servicios,
  });
}
