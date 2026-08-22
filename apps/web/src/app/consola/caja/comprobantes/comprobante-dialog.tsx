"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";

const TIPOS = [
  { value: "boleta", label: "Boleta" },
  { value: "factura", label: "Factura" },
] as const;

export function ComprobanteDialog({
  pagos,
  serieSugerida,
  correlativoSugerido,
}: {
  pagos: Array<{ id: string; label: string }>;
  serieSugerida: string;
  correlativoSugerido: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [paymentId, setPaymentId] = useState("");
  const [tipo, setTipo] = useState("boleta");
  const [serie, setSerie] = useState(serieSugerida);
  const [correlativo, setCorrelativo] = useState(String(correlativoSugerido));

  function cerrar() {
    setOpen(false);
    setPaymentId("");
    setTipo("boleta");
    setSerie(serieSugerida);
    setCorrelativo(String(correlativoSugerido));
  }

  function onTipoChange(valor: string) {
    const prefijo = serie.trim().toUpperCase().slice(0, 1);
    if (valor === "factura" && prefijo === "B") setSerie("F001");
    else if (valor === "boleta" && prefijo === "F") setSerie("B001");
    setTipo(valor);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!paymentId) {
      toast.error("Selecciona un pago");
      return;
    }
    const correlativoNum = Number(correlativo);
    if (!Number.isInteger(correlativoNum) || correlativoNum < 1) {
      toast.error("Ingresa un correlativo válido");
      return;
    }
    start(async () => {
      const r = await fetch("/api/caja/comprobantes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, tipo, serie, correlativo: correlativoNum }),
      });
      if (r.status === 409) {
        toast.error("Ese correlativo ya está en uso");
        return;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(`No se pudo emitir el comprobante: ${j.error ?? "error"}`);
        return;
      }
      toast.success("Comprobante emitido");
      cerrar();
      setTimeout(() => router.refresh(), 300);
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Receipt className="size-4" />
        Emitir comprobante
      </Button>

      <Dialog
        open={open}
        onClose={cerrar}
        title="Emitir comprobante"
        icon={<Receipt className="size-4 text-primary" />}
        description="Asocia un pago registrado en caja con su boleta o factura. Las notas de crédito se generan automáticamente al dar de baja un comprobante."
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="comp-pago">
              Pago
            </label>
            <Select
              id="comp-pago"
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
              autoFocus
              required
            >
              <option value="">Selecciona un pago…</option>
              {pagos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="comp-tipo">
              Tipo
            </label>
            <Select
              id="comp-tipo"
              value={tipo}
              onChange={(e) => onTipoChange(e.target.value)}
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="comp-serie">
                Serie
              </label>
              <Input
                id="comp-serie"
                placeholder="B001"
                maxLength={12}
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="comp-correlativo"
              >
                Correlativo
              </label>
              <Input
                id="comp-correlativo"
                type="number"
                min="1"
                step="1"
                className="tabular-nums"
                value={correlativo}
                onChange={(e) => setCorrelativo(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={cerrar} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              <Receipt className="size-4" />
              Emitir
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
