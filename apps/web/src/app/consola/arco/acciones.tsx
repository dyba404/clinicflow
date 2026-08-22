"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Download, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ArcoAcciones({
  id,
  paciente,
  estado,
}: {
  id: string;
  paciente: string;
  estado: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function resolver(nuevoEstado: "atendida" | "rechazada") {
    const mensaje =
      nuevoEstado === "atendida"
        ? `Atender la solicitud ARCO de ${paciente} y descargar su paquete de datos, si corresponde.`
        : `Rechazar la solicitud ARCO de ${paciente}.`;
    if (!window.confirm(mensaje)) return;
    start(async () => {
      const r = await fetch(`/api/arco/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error(
          j.error === "ya_resuelta"
            ? "La solicitud ya fue resuelta."
            : `No se pudo resolver la solicitud: ${j.error ?? "error"}`,
        );
        return;
      }
      toast.success(`Solicitud ${nuevoEstado}.`);
      setTimeout(() => router.refresh(), 300);
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {estado === "pendiente" ? (
        <>
          <Button size="sm" onClick={() => resolver("atendida")} disabled={pending}>
            <Check className="size-3.5" />
            Atender
          </Button>
          <Button size="sm" variant="outline" onClick={() => resolver("rechazada")} disabled={pending}>
            <X className="size-3.5 text-destructive" />
            Rechazar
          </Button>
        </>
      ) : null}
      {estado === "pendiente" ? (
        <a
          href={`/api/arco/${id}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          title="Descargar paquete de datos del paciente (ZIP)"
        >
          <Download className="size-3.5" />
          ZIP
        </a>
      ) : null}
    </div>
  );
}
