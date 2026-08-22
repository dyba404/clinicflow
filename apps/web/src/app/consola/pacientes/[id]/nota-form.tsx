"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eliminarBorrador, guardarBorrador, leerBorrador } from "@/lib/offline-store";
import { cn } from "@/lib/utils";

const MAX = 2000;

export function NotaForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nota, setNota] = useState("");

  const clave = `nota-clinica:${patientId}`;
  const limpio = nota.trim();

  useEffect(() => {
    let activo = true;
    leerBorrador(clave).then((borrador) => {
      if (activo && borrador?.contenido) {
        setNota(borrador.contenido);
        toast.info("Se recuperó un borrador sin conexión");
      }
    });
    return () => {
      activo = false;
    };
  }, [clave]);

  useEffect(() => {
    if (!nota) return;
    const t = setTimeout(() => {
      void guardarBorrador(clave, nota);
    }, 600);
    return () => clearTimeout(t);
  }, [clave, nota]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!limpio || limpio.length > MAX) {
      toast.error("La nota debe tener entre 1 y 2000 caracteres");
      return;
    }
    start(async () => {
      const r = await fetch(`/api/pacientes/${patientId}/registros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota: limpio }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(`No se pudo guardar la nota: ${j.error ?? "error"}`);
        return;
      }
      toast.success("Nota añadida");
      void eliminarBorrador(clave);
      setNota("");
      setTimeout(() => router.refresh(), 300);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <textarea
        className={cn(
          "w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        )}
        rows={3}
        maxLength={MAX}
        placeholder="Escribe una nota clínica…"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-muted-foreground">
          {nota.length} / {MAX}
        </span>
        <Button type="submit" size="sm" disabled={pending || limpio.length === 0}>
          <Plus className="size-4" />
          Añadir nota
        </Button>
      </div>
    </form>
  );
}
