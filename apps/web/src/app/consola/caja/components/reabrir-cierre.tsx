"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";

export function ReabrirCierre({ cierreId, fecha }: { cierreId: string; fecha: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");

  function onSubmit() {
    if (motivo.trim().length < 3) {
      toast.error("Escribe el motivo de la reapertura (mínimo 3 caracteres)");
      return;
    }
    start(async () => {
      const r = await fetch(`/api/caja/cierre/${cierreId}/reabrir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(`No se pudo reabrir: ${j.error ?? "error"}`);
        return;
      }
      setOpen(false);
      setMotivo("");
      toast.success(`Cierre del ${fecha} reabierto. Vuelve a cerrarlo cuando corrijas.`);
      setTimeout(() => router.refresh(), 300);
    });
  }

  return (
    <>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}>
        <Unlock className="size-3.5" />
        Reabrir
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Reabrir cierre del ${fecha}`}
        icon={<Unlock className="size-4 text-primary" />}
        description="Permite corregir pagos y volver a cerrar el día. Solo el dueño puede hacerlo."
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="motivo-reapertura">
              Motivo (obligatorio)
            </label>
            <Input
              id="motivo-reapertura"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. diferencia detectada al día siguiente"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button size="sm" onClick={onSubmit} disabled={pending}>
              <Unlock className="size-3.5" />
              Reabrir cierre
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
