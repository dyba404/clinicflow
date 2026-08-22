"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AseguradoraDialog, type AseguradoraDatos } from "./aseguradora-dialog";

export function AseguradoraCardActions({
  aseguradora,
}: {
  aseguradora: AseguradoraDatos;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggleActivo() {
    start(async () => {
      const method = aseguradora.activo ? "DELETE" : "PATCH";
      const body = aseguradora.activo ? undefined : JSON.stringify({ activo: true });
      const res = await fetch(`/api/aseguradoras/${aseguradora.id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo actualizar: ${j.error ?? "error"}`);
        return;
      }
      toast.success(aseguradora.activo ? "Aseguradora desactivada." : "Aseguradora activada.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <AseguradoraDialog aseguradora={aseguradora} />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground"
        disabled={pending}
        onClick={toggleActivo}
      >
        {pending ? "Guardando…" : aseguradora.activo ? "Desactivar" : "Activar"}
      </Button>
    </div>
  );
}
