"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePlus2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface PacienteResult {
  id: string;
  nombre: string;
  celular: string;
}

const TIPOS = [
  { value: "acceso", label: "Acceso" },
  { value: "rectificacion", label: "Rectificación" },
  { value: "cancelacion", label: "Cancelación" },
  { value: "oposicion", label: "Oposición" },
];

const ERROR_MSG: Record<string, string> = {
  paciente_requerido: "Selecciona un paciente.",
  tipo_invalido: "Selecciona un tipo de solicitud válido.",
  paciente_no_encontrado: "El paciente ya no existe en este equipo.",
  sin_sesion: "Tu sesión expiró. Vuelve a iniciar sesión.",
  sin_permiso: "No tienes permiso para esta acción.",
};

export function SolicitudDialog() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<PacienteResult[]>([]);
  const [seleccion, setSeleccion] = useState<PacienteResult | null>(null);
  const [tipo, setTipo] = useState("acceso");
  const [detalle, setDetalle] = useState("");
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

  function cerrar() {
    setOpen(false);
    setQ("");
    setResultados([]);
    setSeleccion(null);
    setTipo("acceso");
    setDetalle("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!seleccion) {
      toast.error("Busca y selecciona un paciente.");
      return;
    }
    start(async () => {
      const r = await fetch("/api/arco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: seleccion.id,
          tipo,
          detalle: detalle.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error(ERROR_MSG[j.error ?? ""] ?? `No se pudo registrar la solicitud: ${j.error ?? "error"}`);
        return;
      }
      toast.success(`Solicitud de ${TIPOS.find((t) => t.value === tipo)?.label ?? tipo} registrada.`);
      cerrar();
      setTimeout(() => router.refresh(), 300);
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <FilePlus2 className="size-4" />
        Nueva solicitud
      </Button>

      <Dialog
        open={open}
        onClose={cerrar}
        title="Nueva solicitud ARCO"
        icon={<FilePlus2 className="size-4 text-primary" />}
        description="Derecho de Acceso, Rectificación, Cancelación u Oposición sobre sus datos personales (Ley 29733)."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="arco-q">Paciente</Label>
            <Input
              id="arco-q"
              value={seleccion ? `${seleccion.nombre} · ${seleccion.celular}` : q}
              onChange={(e) => buscar(e.target.value)}
              placeholder="Busca por nombre, celular o documento…"
              autoComplete="off"
              autoFocus
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
              <p className="text-xs text-muted-foreground">
                Sin coincidencias. Usa un mínimo de 1 carácter.
              </p>
            ) : null}
            {seleccion ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setSeleccion(null)}
              >
                Cambiar paciente
              </Button>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="arco-tipo">Tipo de solicitud</Label>
            <Select id="arco-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="arco-detalle">Detalle (opcional)</Label>
            <Input
              id="arco-detalle"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              maxLength={500}
              placeholder="Ej: solicitó copia de su historia clínica por correo."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={cerrar} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !seleccion}>
              <Search className="size-4" />
              Registrar solicitud
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
