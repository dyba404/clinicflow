"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

async function enviarRecall(pacienteIds: string[]): Promise<{ ok: boolean; j: Record<string, unknown> }> {
  const r = await fetch("/api/recall", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo: "recall", pacienteIds }),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, j };
}

export function RecordarButton({ pacienteId, nombre }: { pacienteId: string; nombre: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function recordar() {
    setPending(true);
    try {
      const { ok, j } = await enviarRecall([pacienteId]);
      if (!ok) {
        toast.error(
          j.error === "email_no_configurado"
            ? "El envío por email no está configurado. Configura RESEND_API_KEY."
            : `No se pudo enviar: ${j.error ?? "error"}`,
        );
        return;
      }
      if ((j.enviados as number) > 0) {
        toast.success(`Recordatorio enviado a ${nombre}`);
      } else {
        toast.error(
          `${nombre} no tiene correo registrado. No se pudo enviar el recordatorio.`,
        );
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={recordar} disabled={pending}>
      <MessageSquare className="size-3.5" />
      {pending ? "Enviando…" : "Recordar"}
    </Button>
  );
}

export function RecordarTodos({ total, pacienteIds }: { total: number; pacienteIds: string[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function recordarTodos() {
    setPending(true);
    try {
      const { ok, j } = await enviarRecall(pacienteIds);
      if (!ok) {
        toast.error(
          j.error === "email_no_configurado"
            ? "El envío por email no está configurado. Configura RESEND_API_KEY."
            : `No se pudo enviar: ${j.error ?? "error"}`,
        );
        return;
      }
      const enviados = j.enviados as number;
      toast.success(`${enviados} de ${total} recordatorios enviados por email.`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="sm" onClick={recordarTodos} disabled={pending}>
      <Bell className="size-4" />
      {pending ? "Enviando…" : `Recordar a ${total}`}
    </Button>
  );
}
