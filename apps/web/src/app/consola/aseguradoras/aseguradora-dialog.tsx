"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AseguradoraDatos = {
  id: string;
  nombre: string;
  ruc: string | null;
  telefono: string | null;
  activo: boolean;
};

export function AseguradoraDialog({ aseguradora }: { aseguradora?: AseguradoraDatos }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [nombre, setNombre] = useState("");
  const [ruc, setRuc] = useState("");
  const [telefono, setTelefono] = useState("");

  const esEdicion = Boolean(aseguradora);

  function abrir() {
    setNombre(aseguradora?.nombre ?? "");
    setRuc(aseguradora?.ruc ?? "");
    setTelefono(aseguradora?.telefono ?? "");
    setOpen(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio || nombreLimpio.length > 80) {
      toast.error("El nombre es obligatorio (máx. 80 caracteres).");
      return;
    }
    const rucLimpio = ruc.trim();
    if (rucLimpio && !/^\d{11}$/.test(rucLimpio)) {
      toast.error("El RUC debe tener exactamente 11 dígitos.");
      return;
    }

    start(async () => {
      const res = await fetch(
        esEdicion ? `/api/aseguradoras/${aseguradora!.id}` : "/api/aseguradoras",
        {
          method: esEdicion ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: nombreLimpio,
            ruc: esEdicion ? rucLimpio || null : rucLimpio || undefined,
            telefono: esEdicion ? telefono.trim() || null : telefono.trim() || undefined,
          }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo guardar la aseguradora: ${j.error ?? "error"}`);
        return;
      }
      toast.success(esEdicion ? "Aseguradora actualizada." : "Aseguradora creada.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {esEdicion ? (
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={abrir}>
          <Pencil className="size-3.5" />
          Editar
        </Button>
      ) : (
        <Button type="button" onClick={abrir}>
          <Plus className="size-4" />
          Nueva aseguradora
        </Button>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={esEdicion ? "Editar aseguradora" : "Nueva aseguradora"}
        icon={<ShieldCheck className="size-4 text-primary" />}
        description="EPS, seguro o entidad que cubre tratamientos de tus pacientes."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              placeholder="Pacífico EPS"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>RUC</Label>
              <Input
                value={ruc}
                onChange={(e) => setRuc(e.target.value.replace(/[^\d]/g, "").slice(0, 11))}
                inputMode="numeric"
                placeholder="20100000000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                maxLength={30}
                placeholder="(01) 000-0000"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear aseguradora"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
