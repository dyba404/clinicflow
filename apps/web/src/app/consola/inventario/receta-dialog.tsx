"use client";

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FlaskConical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type OpcionItem = { id: string; nombre: string; unidad: string };
type MaterialReceta = { itemId: string; cantidad: string };

export function RecetaDialog({ servicioId, nombre }: { servicioId: string; nombre: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [cargando, setCargando] = useState(false);
  const [opciones, setOpciones] = useState<OpcionItem[]>([]);
  const [materiales, setMateriales] = useState<MaterialReceta[]>([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [resItems, resReceta] = await Promise.all([
        fetch("/api/inventario/items"),
        fetch(`/api/servicios/${servicioId}/receta`),
      ]);
      const jItems = await resItems.json().catch(() => ({}));
      const jReceta = await resReceta.json().catch(() => ({}));
      if (!resItems.ok || !resReceta.ok) {
        toast.error("No se pudo cargar la receta.");
        return;
      }
      setOpciones(
        ((jItems.items ?? []) as Array<{ id: string; nombre: string; unidad: string }>).map((i) => ({
          id: i.id,
          nombre: i.nombre,
          unidad: i.unidad,
        })),
      );
      setMateriales(
        ((jReceta.materiales ?? []) as Array<{ itemId: string; cantidad: string }>).map((m) => ({
          itemId: m.itemId,
          cantidad: String(Number(m.cantidad)),
        })),
      );
    } finally {
      setCargando(false);
    }
  }, [servicioId]);

  useEffect(() => {
    if (!open || opciones.length > 0) return;
    void cargar();
  }, [open, opciones.length, cargar]);

  function agregar() {
    setMateriales((prev) => [...prev, { itemId: "", cantidad: "1" }]);
  }

  function actualizar(idx: number, campo: keyof MaterialReceta, valor: string) {
    setMateriales((prev) => prev.map((m, i) => (i === idx ? { ...m, [campo]: valor } : m)));
  }

  function quitar(idx: number) {
    setMateriales((prev) => prev.filter((_, i) => i !== idx));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const limpios = materiales.filter((m) => m.itemId !== "");
    for (const m of limpios) {
      const cant = Number(m.cantidad);
      if (!Number.isFinite(cant) || cant <= 0) {
        toast.error("Todas las cantidades deben ser mayores a cero.");
        return;
      }
    }

    start(async () => {
      const res = await fetch(`/api/servicios/${servicioId}/receta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materiales: limpios }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo guardar la receta: ${j.error ?? "error"}`);
        return;
      }
      toast.success("Receta guardada.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}>
        <FlaskConical className="size-3.5" />
        Receta
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Receta de «${nombre}»`}
        icon={<FlaskConical className="size-4 text-primary" />}
        description="Al atender una cita de este servicio, estos materiales se descuentan del stock."
        className="max-w-xl"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {cargando ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : opciones.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Primero crea artículos de inventario para poder armar recetas.
            </p>
          ) : (
            <div className="space-y-3">
              {materiales.map((m, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {idx === 0 && <Label>Material</Label>}
                    <Select value={m.itemId} onChange={(e) => actualizar(idx, "itemId", e.target.value)}>
                      <option value="">Seleccionar…</option>
                      {opciones.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nombre}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-28 space-y-1.5">
                    {idx === 0 && <Label>Cantidad</Label>}
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={m.cantidad}
                      onChange={(e) => actualizar(idx, "cantidad", e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 shrink-0 p-0"
                    aria-label="Quitar material"
                    onClick={() => quitar(idx)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}

              <Button type="button" variant="outline" size="sm" onClick={agregar}>
                <Plus className="size-3.5" />
                Agregar material
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || cargando}>
              {pending ? "Guardando…" : "Guardar receta"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
