"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function WhatsAppForm({
  phoneNumberId,
  activo,
  tokenGuardado,
  masterKeyOk,
}: {
  phoneNumberId: string | null;
  activo: boolean;
  tokenGuardado: boolean;
  masterKeyOk: boolean;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(phoneNumberId ?? "");
  const [token, setToken] = useState("");
  const [activoLocal, setActivoLocal] = useState(activo);
  const [saving, setSaving] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!masterKeyOk) {
      toast.error("Define LOCAL_MASTER_KEY en .env.local para cifrar el token.");
      return;
    }
    if (activoLocal && !phone.trim()) {
      toast.error("Ingresa el ID de número de teléfono.");
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      phoneNumberId: phone.trim() || null,
      activo: activoLocal,
    };
    if (token.trim()) payload.token = token.trim();
    fetch("/api/config/whatsapp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          toast.error(
            j.error === "master_key_no_configurada"
              ? "Falta LOCAL_MASTER_KEY en el servidor para cifrar el token."
              : j.error === "datos_incompletos"
                ? "Para activar necesitas el ID de número y un token."
                : `No se pudo guardar: ${j.error ?? "error"}`,
          );
          return;
        }
        toast.success("Configuración de WhatsApp guardada.");
        setToken("");
        router.refresh();
      })
      .finally(() => setSaving(false));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="wa-phone">ID de número de teléfono (Phone Number ID)</Label>
        <Input
          id="wa-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="123456789012345"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wa-token">Token de acceso</Label>
        <Input
          id="wa-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={tokenGuardado ? "•••••••• (guardado: deja vacío para no cambiarlo)" : "EAAG…"}
          autoComplete="new-password"
        />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={activoLocal}
          onChange={(e) => setActivoLocal(e.target.checked)}
        />
        Activar envío por WhatsApp
      </label>
      <Button type="submit" disabled={saving}>
        <Save className="size-4" />
        {saving ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
