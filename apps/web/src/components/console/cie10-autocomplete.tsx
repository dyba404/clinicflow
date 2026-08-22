"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type CodigoCie10 = { codigo: string; descripcion: string };

export function Cie10Autocomplete({
  onSelect,
  placeholder,
}: {
  onSelect: (codigo: string, descripcion: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<CodigoCie10[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const contRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const texto = q.trim();
    if (!texto) {
      setResultados([]);
      setAbierto(false);
      return;
    }
    const t = setTimeout(() => {
      setCargando(true);
      fetch(`/api/cie10?q=${encodeURIComponent(texto)}&limit=20`)
        .then(async (r) => (r.ok ? r.json() : { codigos: [] }))
        .then((j: { codigos: CodigoCie10[] }) => {
          setResultados(j.codigos ?? []);
          setAbierto(true);
        })
        .catch(() => setResultados([]))
        .finally(() => setCargando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (contRef.current && !contRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function elegir(c: CodigoCie10) {
    setQ(`${c.codigo} — ${c.descripcion}`);
    setAbierto(false);
    onSelect(c.codigo, c.descripcion);
  }

  return (
    <div ref={contRef} className="relative">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q && resultados.length > 0 && setAbierto(true)}
        placeholder={placeholder ?? "Buscar diagnóstico CIE-10…"}
      />
      {abierto ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-card shadow-md">
          {cargando ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Buscando…</li>
          ) : resultados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados.</li>
          ) : (
            resultados.map((c) => (
              <li key={c.codigo}>
                <button
                  type="button"
                  onClick={() => elegir(c)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className="shrink-0 font-mono text-xs font-semibold text-primary">
                    {c.codigo}
                  </span>
                  <span className="min-w-0 flex-1 text-muted-foreground">{c.descripcion}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
