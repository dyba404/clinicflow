"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Check, Send, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";

const ERROR_MSG: Record<string, string> = {
  email_no_configurado: "El envío por email no está configurado. Configura RESEND_API_KEY.",
  paciente_sin_email: "El paciente no tiene correo registrado.",
  transicion_invalida: "No se puede cambiar al estado indicado.",
  sin_sesion: "Tu sesión expiró. Vuelve a iniciar sesión.",
  sin_permiso: "No tienes permiso para esta acción.",
};

export function AccionesWaitlist({
  id,
  estado,
  conEmail,
  nombre,
}: {
  id: string;
  estado: "activa" | "ofrecida";
  conEmail: boolean;
  nombre: string;
}) {
  const router = useRouter();
  const [accion, setAccion] = useState<string | null>(null);

  async function ejecutar(key: string, fn: () => Promise<Response>, exito: string) {
    setAccion(key);
    try {
      const r = await fn();
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        toast.error(ERROR_MSG[j.error as string] ?? `No se pudo completar: ${j.error ?? "error"}`);
        return;
      }
      toast.success(exito);
      router.refresh();
    } catch {
      toast.error("No se pudo completar la acción.");
    } finally {
      setAccion(null);
    }
  }

  function notificar() {
    return ejecutar(
      "notificar",
      () =>
        fetch(`/api/waitlist/${id}/notificar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
      `Se ofreció el cupo a ${nombre} por email. Márcalo como ofrecida.`,
    );
  }

  function marcar(estadoNuevo: "ofrecida" | "aceptada" | "retirada" | "activa", exito: string) {
    return ejecutar(
      estadoNuevo,
      () =>
        fetch(`/api/waitlist/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: estadoNuevo }),
        }),
      exito,
    );
  }

  function retirar() {
    return ejecutar(
      "retirar",
      () => fetch(`/api/waitlist/${id}`, { method: "DELETE" }),
      `${nombre} retirado de la lista de espera.`,
    );
  }

  const ocupado = accion !== null;

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {estado === "activa" ? (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={ocupado || !conEmail}
            onClick={notificar}
            title={conEmail ? "Ofrecer el cupo por email" : "El paciente no tiene email"}
          >
            <Bell className="size-3.5" />
            {accion === "notificar" ? "Enviando…" : "Notificar"}
          </Button>
          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => marcar("ofrecida", `Cupo ofrecido a ${nombre}.`)}>
            <Send className="size-3.5" />
            {accion === "ofrecida" ? "…" : "Ofrecida"}
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => marcar("activa", `${nombre} vuelve a la lista (no respondió o declinó).`)}>
            <Bell className="size-3.5" />
            {accion === "activa" ? "…" : "Re-encolar"}
          </Button>
          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => marcar("aceptada", `${nombre} aceptó el cupo.`)}>
            <Check className="size-3.5" />
            {accion === "aceptada" ? "…" : "Aceptada"}
          </Button>
        </>
      )}
      <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={ocupado} onClick={retirar}>
        <UserMinus className="size-3.5" />
        {accion === "retirar" ? "…" : "Retirar"}
      </Button>
    </div>
  );
}
