"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { fmtPEN } from "@/lib/format";

export function AnularPago({
  pagoId,
  monto,
  paciente,
}: {
  pagoId: string;
  monto: number;
  paciente: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");

  function onSubmit() {
    if (motivo.trim().length < 3) {
      toast.error("Escribe el motivo de la anulación (mínimo 3 caracteres)");
      return;
    }
    start(async () => {
      const r = await fetch(`/api/caja/pagos/${pagoId}/anular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(`No se pudo anular: ${j.error ?? "error"}`);
        return;
      }
      const j = await r.json().catch(() => ({}));
      setOpen(false);
      setMotivo("");
      if (j.comisionesRevertidas > 0) {
        toast.success(`Pago anulado. Comisión revertida (${j.comisionesRevertidas}).`);
      } else {
        toast.success("Pago anulado");
      }
      setTimeout(() => router.refresh(), 300);
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
        onClick={() => setOpen(true)}
      >
        <Ban className="size-3.5" />
        Anular
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Anular pago"
        icon={<Ban className="size-4 text-red-600" />}
        description={
          paciente
            ? `Se anulará el pago de ${fmtPEN(monto)} de ${paciente}. Se excluye de totales y revierte comisiones.`
            : `Se anulará el pago de ${fmtPEN(monto)}. Se excluye de totales y revierte comisiones.`
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="motivo-anulacion">
              Motivo (obligatorio)
            </label>
            <Input
              id="motivo-anulacion"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. pago duplicado, error de registro"
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
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={pending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              <Ban className="size-3.5" />
              Anular pago
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
