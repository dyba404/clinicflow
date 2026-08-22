import { legalRenderizadoPorSlug } from "@/lib/legal";
import { LegalDoc, LegalNav } from "../_components/doc";

export const dynamic = "force-dynamic";

export default async function TerminosPage({
  params,
}: Readonly<{ params: Promise<{ clinica: string }> }>) {
  const { clinica } = await params;
  const legal = await legalRenderizadoPorSlug(clinica);
  if (!legal) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">Clínica no encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No existe una clínica con el identificador «{clinica}».
        </p>
      </main>
    );
  }
  return (
    <LegalDoc
      slug={legal.slug}
      titulo="Términos y condiciones de uso"
      subtitulo={`${legal.nombreClinica}`}
      texto={legal.terminos}
    >
      <LegalNav slug={legal.slug} activo="terminos" />
    </LegalDoc>
  );
}
