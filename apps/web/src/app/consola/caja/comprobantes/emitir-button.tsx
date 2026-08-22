"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const MENSAJES: Record<string, string> = {
  modo_manual:
    "La emisión electrónica está desactivada. Actívala en Configuración Fiscal.",
  lycet_no_configurado:
    "Configura el sidecar GREENTER_LYCET_URL (docker compose up -d lycet).",
  master_key_no_configurada:
    "Define LOCAL_MASTER_KEY en .env.local para cifrar tus credenciales SUNAT.",
  factura_requiere_ruc: "La factura requiere RUC del paciente.",
  lycet_inaccesible:
    "No se pudo conectar con el sidecar Greenter/licet. Verifica que esté corriendo.",
  configuracion_incompleta:
    "Completa RUC, Clave SOL y certificado en Configuración Fiscal.",
  comprobante_ya_emitido: "Este comprobante ya fue emitido ante SUNAT.",
  sin_sesion: "Tu sesión expiró. Vuelve a iniciar sesión.",
  sin_permiso: "No tienes permiso para emitir comprobantes.",
};

function mensajeDe(error: string | undefined, message?: string): string {
  if (error && MENSAJES[error]) return MENSAJES[error];
  return message ?? error ?? "No se pudo emitir el comprobante.";
}

export function EmitirButton({
  id,
  sunatEstado,
}: {
  id: string;
  sunatEstado: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const puedeEmitir =
    sunatEstado === "manual" || sunatEstado === "pendiente_envio" || sunatEstado === "rechazado";
  if (!puedeEmitir) return null;

  async function emitir() {
    setConfirmar(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/caja/comprobantes/${id}/emitir`, { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        hash?: string | null;
        message?: string;
      };
      if (!res.ok) {
        toast.error(mensajeDe(j.error, j.message));
        return;
      }
      toast.success(
        j.hash
          ? `Comprobante emitido (hash: ${j.hash.slice(0, 16)}…)`
          : "Comprobante emitido",
      );
      setTimeout(() => router.refresh(), 200);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant={sunatEstado === "rechazado" ? "default" : "outline"}
        onClick={() => {
          if (sunatEstado === "rechazado") setConfirmar(true);
          else void emitir();
        }}
        disabled={loading}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {sunatEstado === "rechazado" ? "Reintentar" : "Emitir"}
      </Button>

      <Dialog
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title="Reintentar emisión"
        icon={<Send className="size-4 text-primary" />}
        description="El intento anterior fue rechazado por SUNAT."
      >
        <p className="text-sm text-muted-foreground">
          Se reenviará el comprobante a SUNAT con los mismos datos. Si el problema
          persiste, revisa los datos del paciente o el correlativo en Configuración Fiscal.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={() => setConfirmar(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void emitir()}>
            <Send className="size-4" />
            Reenviar a SUNAT
          </Button>
        </div>
      </Dialog>
    </>
  );
}
