"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Check, Pencil, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SucursalForm {
  id: string;
  nombre: string;
  slug: string;
  direccion: string | null;
  telefono: string | null;
  activo: boolean;
}

export function NuevaSucursalButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nueva sucursal
      </Button>
      {open ? <SucursalDialog sucursal={undefined} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function EditarSucursalButton({ sucursal }: { sucursal: SucursalForm }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Editar ${sucursal.nombre}`}
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-4" />
      </Button>
      {open ? <SucursalDialog sucursal={sucursal} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function SucursalDialog({
  sucursal,
  onClose,
}: {
  sucursal?: SucursalForm;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nombre, setNombre] = useState(sucursal?.nombre ?? "");
  const [slug, setSlug] = useState(sucursal?.slug ?? "");
  const [direccion, setDireccion] = useState(sucursal?.direccion ?? "");
  const [telefono, setTelefono] = useState(sucursal?.telefono ?? "");
  const [activo, setActivo] = useState(sucursal?.activo ?? true);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      const payload = {
        nombre,
        direccion: direccion || null,
        telefono: telefono || null,
        ...(sucursal
          ? { activo }
          : slug
            ? { slug }
            : {}),
      };
      const r = await fetch(
        sucursal ? `/api/sucursales/${sucursal.id}` : "/api/sucursales",
        {
          method: sucursal ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        const detalle = j.error === "slug_duplicado" ? "el identificador ya existe" : j.error ?? "error";
        toast.error(
          sucursal
            ? `No se pudo actualizar la sucursal: ${detalle}`
            : `No se pudo crear la sucursal: ${detalle}`,
        );
        return;
      }
      toast.success(sucursal ? "Sucursal actualizada" : "Sucursal creada");
      onClose();
      setTimeout(() => router.refresh(), 300);
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={sucursal ? "Editar sucursal" : "Nueva sucursal"}
      icon={<Building2 className="size-4 text-primary" />}
      description="Cada sucursal separa agendas y caja por local."
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="suc-nombre">Nombre</Label>
          <Input
            id="suc-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Sede Miraflores"
            maxLength={60}
            required
          />
        </div>

        {!sucursal ? (
          <div className="space-y-1.5">
            <Label htmlFor="suc-slug">Identificador (opcional)</Label>
            <Input
              id="suc-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Se genera del nombre si se deja vacío"
              maxLength={60}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="suc-direccion">Dirección</Label>
            <Input
              id="suc-direccion"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Ej. Av. Larco 123"
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="suc-telefono">Teléfono</Label>
            <Input
              id="suc-telefono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ej. 987 654 321"
              maxLength={30}
            />
          </div>
        </div>

        {sucursal ? (
          <label
            htmlFor="suc-activo"
            className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2"
          >
            <Checkbox
              id="suc-activo"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
            />
            <span className="text-sm font-medium">Sucursal activa</span>
            {activo ? (
              <Check className="ml-auto size-3.5 text-primary" />
            ) : (
              <X className="ml-auto size-3.5 text-muted-foreground" />
            )}
          </label>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            <Save className="size-4" />
            {sucursal ? "Guardar cambios" : "Crear sucursal"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
