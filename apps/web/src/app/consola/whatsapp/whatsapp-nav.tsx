"use client";

import { cn } from "@/lib/utils";
import { useNavegar } from "@/lib/navegar";

export function WhatsappFiltros({ direccion }: { direccion: string | null }) {
  const ir = useNavegar();
  const irA = (d: string | null) =>
    ir(d ? `/consola/whatsapp?direccion=${d}` : "/consola/whatsapp");
  return (
    <div className="flex items-center gap-1 rounded-full border bg-card p-1">
      {([
        { v: null, label: "Todos" },
        { v: "in", label: "Entrantes" },
        { v: "out", label: "Salientes" },
      ] as const).map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => irA(o.v)}
          className={cn(
            "min-h-9 [@media(pointer:coarse)]:min-h-12 [@media(pointer:coarse)]:text-sm",
            direccion === o.v
              ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
              : "rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const LIMITE = 50;

export function WhatsappPaginacion({
  direccion,
  offset,
  total,
}: {
  direccion: string | null;
  offset: number;
  total: number;
}) {
  const ir = useNavegar();
  const anterior = offset - LIMITE >= 0 ? offset - LIMITE : null;
  const siguiente = offset + LIMITE < total ? offset + LIMITE : null;
  const irA = (nuevoOffset: number) => {
    const sp = new URLSearchParams();
    if (direccion) sp.set("direccion", direccion);
    if (nuevoOffset > 0) sp.set("offset", String(nuevoOffset));
    const q = sp.toString();
    ir(q ? `/consola/whatsapp?${q}` : "/consola/whatsapp");
  };
  if (anterior === null && siguiente === null) return null;
  return (
    <div className="flex items-center justify-between border-t p-3">
      <span className="text-xs tabular-nums text-muted-foreground">
        {offset + 1}–{Math.min(offset + LIMITE, total)} de {total}
      </span>
      <div className="flex gap-2">
        {anterior !== null ? (
          <button
            type="button"
            onClick={() => irA(anterior)}
            className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground [@media(pointer:coarse)]:min-h-12"
          >
            Anteriores
          </button>
        ) : null}
        {siguiente !== null ? (
          <button
            type="button"
            onClick={() => irA(siguiente)}
            className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground [@media(pointer:coarse)]:min-h-12"
          >
            Siguientes
          </button>
        ) : null}
      </div>
    </div>
  );
}