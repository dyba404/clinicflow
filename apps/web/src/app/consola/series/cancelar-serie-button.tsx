"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CancelarSerieButton({ serieId }: { serieId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmar, setConfirmar] = useState(false);

  function cancelar() {
    start(async () => {
      const r = await fetch(`/api/series/${serieId}/cancelar`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(`No se pudo cancelar la serie: ${j.error ?? "error"}`);
        return;
      }
      toast.success(`Serie cancelada (${j.canceladas} citas futuras canceladas)`);
      setConfirmar(false);
      setTimeout(() => router.refresh(), 300);
    });
  }

  if (!confirmar) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirmar(true)} disabled={pending}>
        <XCircle className="size-4" />
        Cancelar
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="destructive" size="sm" onClick={cancelar} disabled={pending}>
        {pending ? "…" : "Confirmar"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirmar(false)} disabled={pending}>
        No
      </Button>
    </div>
  );
}
