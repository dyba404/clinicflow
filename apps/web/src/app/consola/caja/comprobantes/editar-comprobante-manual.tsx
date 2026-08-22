"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";

export function EditarComprobanteManual({
  id,
  numero,
  serieInicial,
  correlativoInicial,
  modo,
}: {
  id: string;
  numero: string;
  serieInicial: string;
  correlativoInicial: number;
  modo: "editar" | "anular";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [serie, setSerie] = useState(serieInicial);
  const [correlativo, setCorrelativo] = useState(String(correlativoInicial));

  const esAnular = modo === "anular";

  function ejecutar() {
    start(async () => {
      let res: Response;
      if (esAnular) {
        res = await fetch(`/api/caja/comprobantes/${id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo: "Anulación manual" }),
        });
      } else {
        const corr = Number(correlativo);
        if (!Number.isInteger(corr) || corr < 1) {
          toast.error("Correlativo inválido");
          return;
        }
        res = await fetch(`/api/caja/comprobantes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serie: serie.trim(), correlativo: corr }),
        });
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(`No se pudo completar: ${j.error ?? "error"}`);
        return;
      }
      setOpen(false);
      toast.success(esAnular ? `Comprobante ${numero} anulado.` : "Comprobante actualizado.");
      setTimeout(() => router.refresh(), 250);
    });
  }

  if (esAnular) {
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
          title={`Anular ${numero}`}
          icon={<Ban className="size-4 text-red-600" />}
          description="Este comprobante manual no fue enviado a SUNAT, por eso se anula directamente."
        >
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={ejecutar}
              disabled={pending}
            >
              <Ban className="size-3.5" />
              Anular
            </Button>
          </div>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs"
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-3.5" />
        Editar
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Editar ${numero}`}
        icon={<Pencil className="size-4 text-primary" />}
        description="Corrige serie o correlativo antes de registrar la emisión."
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="edit-serie">
                Serie
              </label>
              <Input
                id="edit-serie"
                value={serie}
                maxLength={12}
                onChange={(e) => setSerie(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="edit-correlativo"
              >
                Correlativo
              </label>
              <Input
                id="edit-correlativo"
                type="number"
                min="1"
                step="1"
                value={correlativo}
                onChange={(e) => setCorrelativo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button size="sm" onClick={ejecutar} disabled={pending}>
              <Pencil className="size-3.5" />
              Guardar
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
