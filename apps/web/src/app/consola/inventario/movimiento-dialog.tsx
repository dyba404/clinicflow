"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function MovimientoDialog({ itemId, nombre }: { itemId: string; nombre: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [tipo, setTipo] = useState<"ingreso" | "merma" | "ajuste">("ingreso");
  const [cantidad, setCantidad] = useState("");
  const [lote, setLote] = useState("");
  const [vence, setVence] = useState("");
  const [nota, setNota] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const cant = Number(cantidad);
    if (!Number.isFinite(cant) || cant <= 0) {
      toast.error("Ingresa una cantidad válida mayor a cero.");
      return;
    }
    if (tipo === "ingreso" && lote.trim() && vence && !/^\d{4}-\d{2}-\d{2}$/.test(vence)) {
      toast.error("Formato de fecha de vencimiento inválido.");
      return;
    }

    start(async () => {
      const res = await fetch("/api/inventario/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          tipo,
          cantidad: cant,
          lote: tipo === "ingreso" ? lote.trim() : undefined,
          vence: tipo === "ingreso" && lote.trim() ? vence || undefined : undefined,
          nota: nota.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo registrar el movimiento: ${j.error ?? "error"}`);
        return;
      }
      toast.success("Movimiento registrado.");
      setOpen(false);
      setCantidad("");
      setLote("");
      setVence("");
      setNota("");
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}>
        <ArrowLeftRight className="size-3.5" />
        Movimiento
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Registrar movimiento"
        icon={<ArrowLeftRight className="size-4 text-primary" />}
        description={`Mueve el stock de «${nombre}» con un ingreso, merma o ajuste.`}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de movimiento</Label>
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
              <option value="ingreso">Ingreso (compra/reposición)</option>
              <option value="merma">Merma (pérdida)</option>
              <option value="ajuste">Ajuste (inventario físico)</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{tipo === "ajuste" ? "Nuevo stock exacto" : "Cantidad"}</Label>
            <Input type="number" min="0" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required placeholder={tipo === "ajuste" ? "100" : "10"} />
          </div>

          {tipo === "ingreso" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Lote (opcional)</Label>
                <Input value={lote} onChange={(e) => setLote(e.target.value)} maxLength={40} placeholder="L-2026" />
              </div>
              <div className="space-y-1.5">
                <Label>Vencimiento (opcional)</Label>
                <Input type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Nota (opcional)</Label>
            <Input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={100} placeholder="Motivo o referencia" />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Registrando…" : "Registrar"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
