"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Feriado {
  id: string;
  fecha: string;
  nombre: string;
}

const fmtFecha = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function etiquetaFecha(fecha: string) {
  const texto = fmtFecha.format(new Date(`${fecha}T12:00:00`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function FeriadosForm({ feriados }: { feriados: Feriado[] }) {
  const router = useRouter();
  const [fecha, setFecha] = useState("");
  const [nombre, setNombre] = useState("");
  const [pending, setPending] = useState(false);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await fetch("/api/feriados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, nombre }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          j.error === "feriado_duplicado"
            ? "Esa fecha ya está registrada como feriado."
            : `No se pudo agregar: ${j.error ?? "error"}`,
        );
        return;
      }
      toast.success("Feriado agregado.");
      setFecha("");
      setNombre("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function eliminar(id: string) {
    const res = await fetch(`/api/feriados?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("No se pudo eliminar el feriado.");
      return;
    }
    toast.success("Feriado eliminado.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={agregar} className="flex flex-wrap items-end gap-3">
        <div className="w-44 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="feriado-fecha">
            Fecha
          </label>
          <Input
            id="feriado-fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </div>
        <div className="min-w-56 flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="feriado-nombre">
            Nombre
          </label>
          <Input
            id="feriado-nombre"
            placeholder="Feriado nacional"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          <Plus className="size-4" />
          Agregar
        </Button>
      </form>

      {feriados.length > 0 ? (
        <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
          {feriados.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <CalendarOff className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{f.nombre}</span>
                <span className="block text-xs text-muted-foreground">
                  {etiquetaFecha(f.fecha)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => eliminar(f.id)}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Eliminar feriado ${f.nombre}`}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
