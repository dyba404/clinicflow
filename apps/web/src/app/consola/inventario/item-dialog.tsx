"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boxes, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ItemDatos = {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  stockMin: string;
  costoUnit: string;
};

export function ItemDialog({
  modo,
  item,
  triggerLabel,
}: {
  modo: "crear" | "editar";
  item: ItemDatos | null;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidad, setUnidad] = useState("");
  const [stockMin, setStockMin] = useState("");
  const [costoUnit, setCostoUnit] = useState("");

  const esEdicion = modo === "editar";

  function abrir() {
    setNombre(item?.nombre ?? "");
    setCategoria(item?.categoria ?? "");
    setUnidad(item?.unidad ?? "");
    setStockMin(item ? String(Number(item.stockMin)) : "");
    setCostoUnit(item ? String(Number(item.costoUnit)) : "");
    setOpen(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio || nombreLimpio.length > 80) {
      toast.error("El nombre es obligatorio (máx. 80 caracteres).");
      return;
    }
    const min = Number(stockMin || "0");
    const costo = Number(costoUnit || "0");
    if (!Number.isFinite(min) || min < 0 || !Number.isFinite(costo) || costo < 0) {
      toast.error("Stock mínimo y costo deben ser números válidos.");
      return;
    }

    start(async () => {
      const payload = {
        nombre: nombreLimpio,
        categoria: categoria.trim() || undefined,
        unidad: unidad.trim() || undefined,
        stockMin: min,
        costoUnit: costo,
      };
      const res = await fetch(
        esEdicion ? `/api/inventario/items/${item!.id}` : "/api/inventario/items",
        {
          method: esEdicion ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo guardar el artículo: ${j.error ?? "error"}`);
        return;
      }
      toast.success(esEdicion ? "Artículo actualizado." : "Artículo creado.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {esEdicion ? (
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={abrir} aria-label="Editar artículo">
          <Pencil className="size-3.5" />
        </Button>
      ) : (
        <Button type="button" onClick={abrir}>
          <Plus className="size-4" />
          {triggerLabel ?? "Nuevo artículo"}
        </Button>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={esEdicion ? "Editar artículo" : "Nuevo artículo"}
        icon={<Boxes className="size-4 text-primary" />}
        description="Producto o material del inventario de la clínica."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder="Anestesia tópica" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} maxLength={40} placeholder="Consumible" />
            </div>
            <div className="space-y-1.5">
              <Label>Unidad</Label>
              <Input value={unidad} onChange={(e) => setUnidad(e.target.value)} maxLength={10} placeholder="und" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stock mínimo</Label>
              <Input type="number" min="0" step="any" value={stockMin} onChange={(e) => setStockMin(e.target.value)} placeholder="1" />
            </div>
            <div className="space-y-1.5">
              <Label>Costo unitario (S/)</Label>
              <Input type="number" min="0" step="any" value={costoUnit} onChange={(e) => setCostoUnit(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            El stock se ajusta mediante los movimientos (ingresos, mermas y ajustes), no desde este formulario.
          </p>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear artículo"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
