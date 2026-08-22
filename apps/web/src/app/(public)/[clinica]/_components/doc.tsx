import Link from "next/link";
import type { ReactNode } from "react";

export function LegalNav({ slug, activo }: { slug: string; activo: "privacidad" | "terminos" }) {
  const clase = (a: boolean) =>
    `rounded-full px-3 py-1 text-sm ${a ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`;
  return (
    <nav className="mb-6 flex gap-2">
      <Link href={`/${slug}/privacidad`} className={clase(activo === "privacidad")}>
        Privacidad
      </Link>
      <Link href={`/${slug}/terminos`} className={clase(activo === "terminos")}>
        Términos de uso
      </Link>
    </nav>
  );
}

export function LegalDoc({
  slug,
  titulo,
  subtitulo,
  texto,
  children,
}: {
  slug: string;
  titulo: string;
  subtitulo: string;
  texto: string;
  children?: ReactNode;
}) {
  const parrafos = texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {children}
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>
      </header>
      <article className="space-y-4 text-sm leading-relaxed text-foreground/90">
        {parrafos.map((p, i) =>
          /^\d+\.\s+\S/.test(p) && p.length < 120 && !p.includes(". ") ? (
            <h2 key={i} className="pt-2 text-base font-semibold">
              {p}
            </h2>
          ) : (
            <p key={i} className="whitespace-pre-wrap">
              {p}
            </p>
          ),
        )}
      </article>
      <footer className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
        <Link href={`/${slug}/reserva`} className="hover:underline">
          ← Volver a reservas
        </Link>
      </footer>
    </main>
  );
}
