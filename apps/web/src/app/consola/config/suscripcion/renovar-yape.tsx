"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const NUMERO = "+51 999 888 777";

export function RenovarYape({ nombrePlan }: { nombrePlan: string }) {
  const [open, setOpen] = useState(false);

  function copiar() {
    void navigator.clipboard?.writeText(NUMERO).then(
      () => toast.success("Número copiado"),
      () => toast.error("No se pudo copiar"),
    );
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Phone className="size-4" />
        Renovar por Yape
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Renovación por Yape o Plin"
        description="El pago es manual: transferimos, validamos y activamos tu plan."
      >
        <ol className="space-y-3">
          <li className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground tabular-nums">
              1
            </span>
            <span className="text-muted-foreground">
              Transfiere por <strong className="text-foreground">Yape o Plin</strong> al número{" "}
              <strong className="text-foreground">{NUMERO}</strong> con el concepto{" "}
              <strong className="text-foreground">&quot;Plan {nombrePlan}&quot;</strong>.
              <button
                type="button"
                onClick={copiar}
                className="ml-1.5 inline-flex items-center gap-1 align-middle text-xs font-medium text-primary hover:underline"
              >
                <Copy className="size-3" />
                Copiar número
              </button>
            </span>
          </li>
          <li className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground tabular-nums">
              2
            </span>
            <span className="text-muted-foreground">
              Envía la captura del pago a{" "}
              <a href="mailto:soporte@clinicflow.pe" className="font-medium text-primary hover:underline">
                soporte@clinicflow.pe
              </a>{" "}
              indicando el nombre de tu clínica.
            </span>
          </li>
          <li className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground tabular-nums">
              3
            </span>
            <span className="text-muted-foreground">
              El equipo de Clinicflow activa tu plan <strong className="text-foreground">manualmente en menos de 24 horas</strong> y recibirás un correo de confirmación.
            </span>
          </li>
        </ol>

        <div className="mt-5 flex justify-end">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Entendido
          </Button>
        </div>
      </Dialog>
    </>
  );
}
