"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function NuevoPacienteDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [documento, setDocumento] = useState("");
  const [fnac, setFnac] = useState("");
  const [alergias, setAlergias] = useState("");
  const [gestacion, setGestacion] = useState(false);

  function limpiar() {
    setNombre("");
    setCelular("");
    setEmail("");
    setDocumento("");
    setFnac("");
    setAlergias("");
    setGestacion(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await fetch("/api/pacientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          celular,
          email: email || undefined,
          documento: documento || undefined,
          fnac: fnac || undefined,
          alergias: alergias || undefined,
          gestacion,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 409 && j.existente) {
        toast.error(
          `Ya existe un paciente con ese celular: ${j.existente.nombre}.`,
          {
            action: {
              label: "Abrir ficha",
              onClick: () => router.push(`/consola/pacientes/${j.existente.id}`),
            },
          },
        );
        return;
      }
      if (!res.ok) {
        toast.error(`No se pudo crear el paciente: ${j.error ?? "error"}`);
        return;
      }
      toast.success(`Paciente creado: ${j.paciente?.nombre ?? nombre.trim()}`);
      setOpen(false);
      limpiar();
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nuevo paciente
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo paciente"
        icon={<UserPlus className="size-4 text-primary" />}
        description="Solo nombre y celular son obligatorios."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="np-nombre">Nombre completo</Label>
            <Input
              id="np-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              minLength={3}
              maxLength={80}
              placeholder="Nombre y apellidos"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-celular">Celular</Label>
              <Input
                id="np-celular"
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
                required
                placeholder="987654321"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-doc">Documento (DNI/CE)</Label>
              <Input
                id="np-doc"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                maxLength={20}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-email">Email</Label>
              <Input
                id="np-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-fnac">Fecha de nacimiento</Label>
              <Input
                id="np-fnac"
                type="date"
                value={fnac}
                onChange={(e) => setFnac(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-alergias">Alergias (opcional)</Label>
            <Input
              id="np-alergias"
              value={alergias}
              onChange={(e) => setAlergias(e.target.value)}
              maxLength={200}
              placeholder="Penicilina, lidocaína…"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={gestacion} onChange={(e) => setGestacion(e.target.checked)} />
            Paciente en gestación
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creando…" : "Crear paciente"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
