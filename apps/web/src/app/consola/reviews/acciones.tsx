"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

function errorAmigable(error: string): string {
  switch (error) {
    case "resenas_no_configuradas":
      return "Configura tu enlace de reseñas de Google antes de enviar.";
    case "email_no_configurado":
      return "El envío por email no está configurado (RESEND_API_KEY).";
    case "paciente_sin_email":
      return "Ese paciente no tiene correo registrado.";
    default:
      return `No se pudo completar la acción: ${error ?? "error"}`;
  }
}

export function MarcarRespondidaButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function marcar() {
    setPending(true);
    try {
      const res = await fetch(`/api/reviews/${id}/respondido`, { method: "PATCH" });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        toast.error(errorAmigable(String(j.error ?? "error")));
        return;
      }
      toast.success("Reseña marcada como respondida.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={marcar} disabled={pending}>
      <Check className="size-3.5" />
      {pending ? "Marcando…" : "Marcar respondida"}
    </Button>
  );
}

export interface CandidataResena {
  patientId: string;
  appointmentId: string;
  nombre: string;
  servicio: string;
  horaIni: string;
}

export function NuevaSolicitudDialog({
  candidatas,
}: {
  candidatas: CandidataResena[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [seleccion, setSeleccion] = useState("");

  async function enviar() {
    const elegida = candidatas.find((c) => c.appointmentId === seleccion);
    if (!elegida) return;
    setPending(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: elegida.patientId,
          appointmentId: elegida.appointmentId,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        toast.error(errorAmigable(String(j.error ?? "error")));
        return;
      }
      toast.success(`Solicitud enviada a ${elegida.nombre}`);
      setOpen(false);
      setSeleccion("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        disabled={candidatas.length === 0}
        title={
          candidatas.length === 0
            ? "No hay citas atendidas hoy sin solicitud de reseña"
            : undefined
        }
      >
        <Send className="size-4" />
        Nueva solicitud
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Solicitar reseña"
        description="Pacientes atendidos hoy que aún no recibieron la solicitud."
      >
        {candidatas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay citas atendidas hoy pendientes de solicitud.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rev-select">Paciente</Label>
              <Select
                id="rev-select"
                value={seleccion}
                onChange={(e) => setSeleccion(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {candidatas.map((c) => (
                  <option key={c.appointmentId} value={c.appointmentId}>
                    {c.nombre} · {c.horaIni} · {c.servicio}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={enviar} disabled={!seleccion || pending}>
                {pending ? "Enviando…" : "Enviar solicitud"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
