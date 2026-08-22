import { legalRenderizadoPorSlug } from "@/lib/legal";
import { LegalDoc, LegalNav } from "../_components/doc";

export const dynamic = "force-dynamic";

export default async function PrivacidadPage({
  params,
}: Readonly<{ params: Promise<{ clinica: string }> }>) {
  const { clinica } = await params;
  const legal = await legalRenderizadoPorSlug(clinica);
  if (!legal) return <LegalNotFound slug={clinica} />;
  return (
    <LegalDoc
      slug={legal.slug}
      titulo="Política de privacidad"
      subtitulo={`${legal.nombreClinica} — Ley N.° 29733`}
      texto={legal.privacidad}
    >
      <LegalNav slug={legal.slug} activo="privacidad" />
    </LegalDoc>
  );
}

function LegalNotFound({ slug }: { slug: string }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-lg font-semibold">Clínica no encontrada</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        No existe una clínica con el identificador «{slug}».
      </p>
    </main>
  );
}
