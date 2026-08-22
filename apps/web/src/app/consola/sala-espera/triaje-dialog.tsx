"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Stethoscope, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { TRIAJES, TRIAJE_META, type TriageNivel } from "./triaje";

export function TriajeDialog({
  citaId,
  paciente,
  nivelActual,
}: {
  citaId: string;
  paciente: string;
  nivelActual: TriageNivel | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [seleccion, setSeleccion] = useState<TriageNivel | null>(null);
  const [nota, setNota] = useState("");

  function abrir() {
    setSeleccion(nivelActual);
    setNota("");
    setAbierto(true);
  }

  function guardar(nivel: TriageNivel | null) {
    const notaTrim = nota.trim();
    if (nivel !== null && notaTrim && notaTrim.length < 3) {
      toast.error("La nota debe tener al menos 3 caracteres");
      return;
    }
    start(async () => {
      const r = await fetch(`/api/citas/${citaId}/triaje`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notaTrim ? { nivel, nota: notaTrim } : { nivel }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(`${paciente}: ${j.error ?? "error"}`);
        return;
      }
      toast.success(
        nivel
          ? `${paciente}: triaje ${TRIAJE_META[nivel].label}`
          : `Se quitó el triaje de ${paciente}`,
      );
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={abrir}
        disabled={pending}
        className="min-h-9 flex-1"
      >
        {nivelActual ? "Cambiar triaje" : "Triaje"}
        <Stethoscope className="size-3.5" />
      </Button>
      <Dialog
        open={abierto}
        onClose={() => {
          if (!pending) setAbierto(false);
        }}
        title={`Triaje de ${paciente}`}
        description="Define la prioridad de atención. Los urgentes se muestran primero en la sala."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {TRIAJES.map((n) => {
            const meta = TRIAJE_META[n];
            const activo = seleccion === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setSeleccion(n)}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border p-3 text-sm font-semibold transition-colors",
                  activo
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "hover:bg-accent",
                )}
              >
                <span className={cn("size-2.5 rounded-full", meta.punto)} />
                {meta.label}
                <span className="text-xs font-normal text-muted-foreground">
                  {meta.descripcion}
                </span>
              </button>
            );
          })}
        </div>
        <Textarea
          className="mt-3"
          placeholder="Nota opcional (mín. 3 caracteres)"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          disabled={pending}
        />
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {nivelActual ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => guardar(null)}
              disabled={pending}
            >
              Quitar triaje
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAbierto(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button size="sm" onClick={() => guardar(seleccion)} disabled={pending || !seleccion}>
            {pending && <Undo2 className="size-3.5 animate-spin" />}
            Guardar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
