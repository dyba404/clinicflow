"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@clinicflow/core";

const REVERSIBLES: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
  en_espera: "confirmada",
  en_atencion: "en_espera",
};

async function postEstado(citaId: string, estado: AppointmentStatus) {
  const r = await fetch(`/api/citas/${citaId}/estado`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado }),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, json: j };
}

export function AvanzarEstado({
  citaId,
  paciente,
  de,
  a,
  label,
  className,
}: {
  citaId: string;
  paciente: string;
  de: AppointmentStatus;
  a: AppointmentStatus;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const toastId = useRef<string | number | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function ejecutar() {
    setConfirmando(false);
    if (timer.current) clearTimeout(timer.current);
    if (toastId.current !== undefined) toast.dismiss(toastId.current);

    start(async () => {
      const { ok, json } = await postEstado(citaId, a);
      if (!ok) {
        toast.error(`${paciente}: ${json.error ?? "error"}`);
        return;
      }

      const faltantes: string[] = Array.isArray(json.faltantes) ? json.faltantes : [];
      const base = `${paciente} pasó de ${de.replace(/_/g, " ")} a ${a.replace(/_/g, " ")}`;
      if (faltantes.length > 0) {
        toast.warning(`${base}. Sin stock de: ${faltantes.join(", ")}`);
      }

      const reversa = REVERSIBLES[a];
      router.refresh();
      if (!reversa) return;

      toastId.current = toast.success(base, {
        duration: 5000,
        action: {
          label: "Deshacer",
          onClick: () => {
            start(async () => {
              const { ok: okR, json: jr } = await postEstado(citaId, reversa);
              if (!okR) {
                toast.error(`No se pudo deshacer: ${jr.error ?? "error"}`);
                return;
              }
              toast.success(`${paciente} volvió a ${reversa.replace(/_/g, " ")}`);
              router.refresh();
            });
          },
        },
      });
      timer.current = setTimeout(() => {
        if (toastId.current !== undefined) toast.dismiss(toastId.current);
      }, 5200);
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setConfirmando(true)}
        disabled={pending}
        className={cn(className)}
      >
        {label}
        <ArrowRight className="size-3.5" />
      </Button>
      <Dialog
        open={confirmando}
        onClose={() => setConfirmando(false)}
        title={`${label} a ${paciente}`}
        description={`La cita pasará de ${de.replace(/_/g, " ")} a ${a.replace(
          /_/g,
          " ",
        )}. Podrás deshacerlo unos segundos.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirmando(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button size="sm" onClick={ejecutar} disabled={pending}>
            {pending && <Undo2 className="size-3.5 animate-spin" />}
            Confirmar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
