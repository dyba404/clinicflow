"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Megaphone, Play, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const ERROR_MSG: Record<string, string> = {
  email_no_configurado: "El envío por email no está configurado. Configura RESEND_API_KEY.",
  tipo_invalido: "Selecciona un tipo de campaña válido.",
  titulo_invalido: "El título es obligatorio (máximo 120 caracteres).",
  mensaje_invalido: "El mensaje es obligatorio (máximo 500 caracteres).",
  ya_ejecutada: "Esta campaña ya fue ejecutada.",
  sin_sesion: "Tu sesión expiró. Vuelve a iniciar sesión.",
  sin_permiso: "No tienes permiso para esta acción.",
};

export function NuevaCampanaDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"cumple" | "reactivacion">("cumple");
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  function reset() {
    setTipo("cumple");
    setTitulo("");
    setMensaje("");
    setOpen(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mensaje.length > 500) {
      toast.error("El mensaje no debe exceder 500 caracteres.");
      return;
    }
    setGuardando(true);
    try {
      const r = await fetch("/api/campanas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, titulo, mensaje, canal: "email" }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        campana?: { audiencia?: Array<{ patientId: string }> };
        error?: string;
      };
      if (!r.ok) {
        toast.error(ERROR_MSG[j.error ?? ""] ?? `No se pudo crear la campaña: ${j.error ?? "error"}`);
        return;
      }
      const total = j.campana?.audiencia?.length ?? 0;
      toast.success(
        total === 0
          ? "Campaña creada, pero la audiencia calculada es 0. Revisa los datos de tus pacientes."
          : `Campaña creada con ${total} pacientes en audiencia.`,
      );
      reset();
      router.refresh();
    } catch {
      toast.error("No se pudo crear la campaña.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusCircle className="size-4" />
        Nueva campaña
      </Button>

      <Dialog
        open={open}
        onClose={reset}
        title="Nueva campaña"
        icon={<Megaphone className="size-4 text-primary" />}
        description="La audiencia se calcula automáticamente al crear la campaña."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="campana-tipo">Tipo</Label>
            <Select
              id="campana-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "cumple" | "reactivacion")}
            >
              <option value="cumple">Cumpleaños (pacientes activos que cumplen este mes)</option>
              <option value="reactivacion">Reactivación (pacientes sin visita reciente)</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campana-titulo">Título</Label>
            <Input
              id="campana-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: ¡Feliz cumpleaños, {{nombre}}!"
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campana-mensaje">Mensaje</Label>
            <textarea
              id="campana-mensaje"
              className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              rows={4}
              maxLength={500}
              placeholder="Ej: Hola {{nombre}}, queremos celebrar contigo…"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Disponible: <code>{"{{nombre}}"}</code> se reemplaza por el nombre del paciente.{" "}
              {mensaje.length}/500 caracteres.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={reset}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? "Creando…" : "Crear campaña"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function EjecutarCampana({ id, titulo }: { id: string; titulo: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function ejecutar() {
    setPending(true);
    try {
      const r = await fetch(`/api/campanas/${id}/ejecutar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        toast.error(ERROR_MSG[j.error as string] ?? `No se pudo ejecutar: ${j.error ?? "error"}`);
        return;
      }
      const enviadosOk = j.enviadosOk as number;
      const total = j.total as number;
      if (total === 0) {
        toast.success("Campaña completada: ningún paciente tenía email.");
      } else {
        toast.success(`Campaña "${titulo}": ${enviadosOk} de ${total} emails enviados.`);
      }
      router.refresh();
    } catch {
      toast.error("No se pudo ejecutar la campaña.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={ejecutar} disabled={pending}>
      <Play className="size-3.5" />
      {pending ? "Ejecutando…" : "Ejecutar"}
    </Button>
  );
}
