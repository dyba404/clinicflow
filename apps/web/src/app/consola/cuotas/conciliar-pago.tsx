"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fmtPEN } from "@/lib/format";

export function ConciliarPago({ paymentId, monto }: { paymentId: string; monto: number }) {
  const router = useRouter();
  const [accion, setAccion] = useState<"confirmar" | "rechazar" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);

  async function ejecutar() {
    if (!accion) return;
    setProcesando(true);
    try {
      const r = await fetch("/api/cuotas/conciliar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId,
          accion,
          motivo: accion === "rechazar" && motivo.trim() ? motivo : undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "error");
      toast.success(
        accion === "confirmar"
          ? `Pago de ${fmtPEN(monto)} conciliado y cuota marcada pagada.`
          : "Registro rechazado. El paciente podrá pagar nuevamente.",
      );
      setAccion(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <>
      <div className="flex justify-end gap-1.5">
        <Button size="sm" onClick={() => setAccion("confirmar")}>
          <CheckCircle2 className="size-3.5" />
          Conciliar
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAccion("rechazar")}>
          <XCircle className="size-3.5" />
          Rechazar
        </Button>
      </div>

      <Dialog
        open={accion !== null}
        onClose={() => {
          if (!procesando) setAccion(null);
        }}
        title={accion === "confirmar" ? "Confirmar pago QR" : "Rechazar pago QR"}
        description={
          accion === "confirmar"
            ? "Confirma solo si la transferencia por Yape/Plin aparece en tu banca."
            : "El registro se anulará y el paciente podrá generar otro QR."
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm tabular-nums">
            Monto: <span className="font-semibold">{fmtPEN(monto)}</span>
          </div>
          {accion === "rechazar" && (
            <div className="space-y-1.5">
              <label htmlFor="conciliar-motivo" className="text-xs font-medium text-muted-foreground">
                Motivo (opcional)
              </label>
              <Input
                id="conciliar-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. transferencia no encontrada"
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAccion(null)} disabled={procesando}>
              Cancelar
            </Button>
            <Button
              onClick={() => void ejecutar()}
              disabled={procesando}
              variant={accion === "rechazar" ? "destructive" : "default"}
            >
              {procesando ? "Procesando…" : accion === "confirmar" ? "Sí, conciliar" : "Sí, rechazar"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
