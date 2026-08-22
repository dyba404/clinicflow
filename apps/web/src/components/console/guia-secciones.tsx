import Image from "next/image";
import type { GuiaSeccion } from "@/lib/guias";

const ICONO_EMOJI: Record<string, string> = {
  rocket: "🚀",
  calendar: "📅",
  wallet: "💰",
  receipt: "🧾",
  users: "👥",
  message: "💬",
};

export function GuiaSecciones({ secciones }: { secciones: GuiaSeccion[] }) {
  return (
    <div className="space-y-10">
      {secciones.map((seccion) => (
        <section key={seccion.id}>
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
            <span aria-hidden>{ICONO_EMOJI[seccion.icono] ?? "📖"}</span>
            {seccion.titulo}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">{seccion.descripcion}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {seccion.guias.map((guia) => (
              <article
                key={guia.id}
                className="overflow-hidden rounded-2xl border bg-card shadow-xs"
              >
                {guia.captura ? (
                  <Image
                    src={guia.captura}
                    alt=""
                    width={1440}
                    height={900}
                    loading="lazy"
                    className="max-h-52 w-full border-b object-cover object-top"
                  />
                ) : null}
                <div className="p-5">
                  <h3 className="text-sm font-semibold">{guia.titulo}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{guia.descripcion}</p>
                  <ol className="mt-3 space-y-2">
                    {guia.pasos.map((paso, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed text-foreground/90">{paso}</span>
                      </li>
                    ))}
                  </ol>
                  {guia.tip ? (
                    <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                      💡 {guia.tip}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
