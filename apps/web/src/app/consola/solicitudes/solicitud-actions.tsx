"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SolicitudActions({
  citaId,
  paciente,
}: {
  citaId: string;
  paciente: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function confirmar() {
    start(async () => {
      const r = await fetch(`/api/solicitudes/${citaId}/confirmar`, { method: "POST" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(`No se pudo confirmar: ${j.error ?? "error"}`);
        return;
      }
      toast.success(`Cita de ${paciente} confirmada`);
      setTimeout(() => router.refresh(), 400);
    });
  }

  function rechazar() {
    if (!window.confirm(`¿Rechazar la solicitud de ${paciente}?`)) return;
    start(async () => {
      const r = await fetch(`/api/solicitudes/${citaId}/rechazar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: "rechazada por recepción" }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(`No se pudo rechazar: ${j.error ?? "error"}`);
        return;
      }
      toast.success(`Solicitud de ${paciente} rechazada`);
      setTimeout(() => router.refresh(), 400);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={confirmar} disabled={pending}>
        <Check className="size-3.5" />
        Confirmar
      </Button>
      <Button size="sm" variant="outline" onClick={rechazar} disabled={pending}>
        <X className="size-3.5 text-destructive" />
        Rechazar
      </Button>
    </div>
  );
}
