"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { fmtPEN } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CierreDialog({ totalSistema }: { totalSistema: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [real, setReal] = useState("");

  const realNum = Number(real);
  const hayReal = real.trim() !== "" && Number.isFinite(realNum);
  const diff = hayReal ? realNum - totalSistema : null;

  const diffClass =
    diff === null
      ? ""
      : Math.abs(diff) < 0.005
        ? "text-emerald-600"
        : Math.abs(diff) <= 10
          ? "text-amber-600"
          : "text-red-600";

  function cerrar() {
    setOpen(false);
    setReal("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!hayReal || realNum < 0) {
      toast.error("Ingresa un total contado real válido");
      return;
    }
    start(async () => {
      const r = await fetch("/api/caja/cierre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cierreReal: realNum }),
      });
      if (r.status === 409) {
        toast.error("La caja de hoy ya fue cerrada");
        cerrar();
        return;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(`No se pudo cerrar la caja: ${j.error ?? "error"}`);
        return;
      }
      toast.success("Caja cerrada correctamente");
      cerrar();
      setTimeout(() => router.refresh(), 300);
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Lock className="size-4" />
        Cerrar caja
      </Button>

      <Dialog
        open={open}
        onClose={cerrar}
        title="Cerrar caja"
        icon={<Lock className="size-4 text-primary" />}
        description="Registra el cierre del día comparando el total del sistema con el contado real."
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="cierre-sistema"
            >
              Total del sistema
            </label>
            <Input
              id="cierre-sistema"
              value={fmtPEN(totalSistema)}
              className="tabular-nums"
              readOnly
            />
          </div>
          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="cierre-real"
            >
              Total contado real (S/)
            </label>
            <Input
              id="cierre-real"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="tabular-nums"
              value={real}
              onChange={(e) => setReal(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Diferencia</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                diff === null ? "text-muted-foreground" : diffClass,
              )}
            >
              {diff === null ? "—" : fmtPEN(diff)}
            </span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={cerrar} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              <Lock className="size-4" />
              Confirmar cierre
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
