import Link from "next/link";
import { legalRenderizadoPorSlug } from "@/lib/legal";
import { GUIAS } from "@/lib/guias";
import { GuiaSecciones } from "@/components/console/guia-secciones";

export const dynamic = "force-dynamic";

export default async function GuiaPublicaPage({
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
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Guía de capacitación</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todo lo que tu equipo necesita saber para usar {legal.nombreClinica} con Clinicflow.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Link
            href={`/${legal.slug}/reserva`}
            className="rounded-full border px-3 py-1 text-muted-foreground hover:text-foreground"
          >
            Página de reservas
          </Link>
          <Link
            href={`/${legal.slug}/privacidad`}
            className="rounded-full border px-3 py-1 text-muted-foreground hover:text-foreground"
          >
            Privacidad
          </Link>
          <Link
            href={`/${legal.slug}/terminos`}
            className="rounded-full border px-3 py-1 text-muted-foreground hover:text-foreground"
          >
            Términos de uso
          </Link>
        </div>
      </header>

      <GuiaSecciones secciones={GUIAS} />

      <footer className="mt-12 border-t pt-6 text-center text-xs text-muted-foreground">
        <Link href={`/${legal.slug}/reserva`} className="hover:underline">
          ← Volver a reservas
        </Link>
      </footer>
    </main>
  );
}
