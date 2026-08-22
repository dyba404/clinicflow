"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PacienteResult {
  id: string;
  nombre: string;
  celular: string;
}

const ERROR_MSG: Record<string, string> = {
  paciente_requerido: "Selecciona un paciente.",
  prioridad_invalida: "La prioridad debe ser un número entre 1 y 10.",
  paciente_no_encontrado: "El paciente ya no existe en este equipo.",
  sin_sesion: "Tu sesión expiró. Vuelve a iniciar sesión.",
  sin_permiso: "No tienes permiso para esta acción.",
};

export function AgregarDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<PacienteResult[]>([]);
  const [seleccion, setSeleccion] = useState<PacienteResult | null>(null);
  const [preferencia, setPreferencia] = useState("");
  const [prioridad, setPrioridad] = useState(5);
  const [guardando, setGuardando] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buscar(texto: string) {
    setQ(texto);
    setSeleccion(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (texto.trim().length < 1) {
      setResultados([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await fetch(`/api/pacientes?q=${encodeURIComponent(texto.trim())}`);
        const j = (await r.json().catch(() => ({}))) as { pacientes?: PacienteResult[] };
        setResultados(r.ok ? j.pacientes ?? [] : []);
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 250);
  }

  function reset() {
    setQ("");
    setResultados([]);
    setSeleccion(null);
    setPreferencia("");
    setPrioridad(5);
    setOpen(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!seleccion) {
      toast.error("Busca y selecciona un paciente.");
      return;
    }
    setGuardando(true);
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: seleccion.id,
          preferencia: preferencia || null,
          prioridad,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { duplicado?: boolean; error?: string };
      if (!r.ok && r.status !== 200) {
        toast.error(ERROR_MSG[j.error ?? ""] ?? `No se pudo agregar: ${j.error ?? "error"}`);
        return;
      }
      toast.success(
        j.duplicado
          ? `${seleccion.nombre} ya está en la lista de espera.`
          : `${seleccion.nombre} agregado a la lista de espera.`,
      );
      reset();
      router.refresh();
    } catch {
      toast.error("No se pudo agregar a la lista de espera.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusCircle className="size-4" />
        Agregar a espera
      </Button>

      <Dialog
        open={open}
        onClose={reset}
        title="Agregar a lista de espera"
        icon={<Search className="size-4 text-primary" />}
        description="Busca al paciente y define su preferencia de horario y prioridad."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wl-q">Paciente</Label>
            <Input
              id="wl-q"
              value={seleccion ? `${seleccion.nombre} · ${seleccion.celular}` : q}
              onChange={(e) => buscar(e.target.value)}
              placeholder="Busca por nombre, celular o documento…"
              autoComplete="off"
            />
            {!seleccion && resultados.length > 0 ? (
              <div className="overflow-hidden rounded-md border">
                {resultados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                    onClick={() => {
                      setSeleccion(p);
                      setResultados([]);
                    }}
                  >
                    <span className="font-medium">{p.nombre}</span>
                    <span className="ml-2 text-muted-foreground">{p.celular}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {!seleccion && q.trim().length > 0 && !buscando && resultados.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin coincidencias. Usa un mínimo de 1 carácter.</p>
            ) : null}
            {seleccion ? (
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setSeleccion(null)}>
                Cambiar paciente
              </Button>
            ) : null}
            {seleccion ? (
              <input type="hidden" name="patientId" value={seleccion.id} />
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wl-preferencia">Preferencia de horario (opcional)</Label>
            <Input
              id="wl-preferencia"
              value={preferencia}
              onChange={(e) => setPreferencia(e.target.value)}
              placeholder="Ej: mañanas, solo fines de semana…"
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wl-prioridad">Prioridad (1 = baja, 10 = alta)</Label>
            <Input
              id="wl-prioridad"
              type="number"
              min={1}
              max={10}
              value={prioridad}
              onChange={(e) => setPrioridad(Number(e.target.value))}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={reset}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando || !seleccion}>
              {guardando ? "Agregando…" : "Agregar a espera"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
