"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ActivarPortalButton({ patientId }: { patientId: string }) {
  const [cargando, setCargando] = useState(false);

  async function activar() {
    setCargando(true);
    try {
      const r = await fetch(`/api/pacientes/${patientId}/activar-portal`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j.error === "portal_ya_activo") {
          toast.info("El paciente ya tiene su portal activado.");
        } else if (j.error === "sin_canal_de_envio") {
          toast.error("No hay email ni WhatsApp configurado para enviar el enlace.");
        } else {
          toast.error(`No se pudo activar el portal: ${j.error ?? "error"}`);
        }
        return;
      }
      toast.success(`Enlace de activación enviado por ${j.canal}.`);
    } catch {
      toast.error("No se pudo activar el portal.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={cargando} onClick={() => void activar()}>
      {cargando ? <Loader2 className="size-3.5 animate-spin" /> : <Smartphone className="size-3.5" />}
      Activar portal
    </Button>
  );
}
