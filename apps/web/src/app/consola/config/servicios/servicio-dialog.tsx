"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, Plus, Save, Stethoscope, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ServicioForm {
  id: string;
  nombre: string;
  duracionMin: number;
  precio: string;
  bufferMin: number;
  activo: boolean;
}

export function NuevoServicioButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nuevo servicio
      </Button>
      {open ? (
        <ServicioDialog servicio={undefined} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

export function EditarServicioButton({ servicio }: { servicio: ServicioForm }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Editar ${servicio.nombre}`}
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-4" />
      </Button>
      {open ? (
        <ServicioDialog servicio={servicio} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

export function ServicioDialog({
  servicio,
  onClose,
}: {
  servicio?: ServicioForm;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nombre, setNombre] = useState(servicio?.nombre ?? "");
  const [duracionMin, setDuracionMin] = useState(
    String(servicio?.duracionMin ?? 30),
  );
  const [precio, setPrecio] = useState(
    servicio ? Number(servicio.precio).toFixed(2) : "0.00",
  );
  const [bufferMin, setBufferMin] = useState(String(servicio?.bufferMin ?? 0));
  const [activo, setActivo] = useState(servicio?.activo ?? true);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      const payload = {
        nombre,
        duracionMin: Number(duracionMin),
        precio: Number(precio),
        bufferMin: Number(bufferMin),
        activo,
      };
      const r = await fetch(
        servicio ? `/api/servicios/${servicio.id}` : "/api/servicios",
        {
          method: servicio ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(
          servicio
            ? `No se pudo actualizar el servicio: ${j.error ?? "error"}`
            : `No se pudo crear el servicio: ${j.error ?? "error"}`,
        );
        return;
      }
      toast.success(servicio ? "Servicio actualizado" : "Servicio creado");
      onClose();
      setTimeout(() => router.refresh(), 300);
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={servicio ? "Editar servicio" : "Nuevo servicio"}
      icon={<Stethoscope className="size-4 text-primary" />}
      description="La duración, el buffer y el precio definen los horarios disponibles."
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="srv-nombre">Nombre</Label>
          <Input
            id="srv-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Consulta general"
            maxLength={80}
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="srv-duracion">Duración (min)</Label>
            <Input
              id="srv-duracion"
              type="number"
              min={5}
              max={480}
              step={5}
              value={duracionMin}
              onChange={(e) => setDuracionMin(e.target.value)}
              className="tabular-nums"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="srv-precio">Precio (S/)</Label>
            <Input
              id="srv-precio"
              type="number"
              min={0}
              step={0.01}
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="tabular-nums"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="srv-buffer">Buffer (min)</Label>
            <Input
              id="srv-buffer"
              type="number"
              min={0}
              step={5}
              value={bufferMin}
              onChange={(e) => setBufferMin(e.target.value)}
              className="tabular-nums"
              required
            />
          </div>
        </div>

        <label
          htmlFor="srv-activo"
          className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2"
        >
          <Checkbox
            id="srv-activo"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
          />
          <span className="text-sm font-medium">Servicio activo</span>
          {activo ? (
            <Check className="ml-auto size-3.5 text-primary" />
          ) : (
            <X className="ml-auto size-3.5 text-muted-foreground" />
          )}
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            <Save className="size-4" />
            {servicio ? "Guardar cambios" : "Crear servicio"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
