"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { fmtPEN } from "@/lib/format";

export interface AseguradoraBasica {
  id: string;
  nombre: string;
}

export function SplitAseguradora({
  pagoId,
  monto,
  paciente,
  aseguradoras,
}: {
  pagoId: string;
  monto: number;
  paciente: string | null;
  aseguradoras: AseguradoraBasica[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [insurerId, setInsurerId] = useState("");
  const [montoAseguradora, setMontoAseguradora] = useState("");

  const valor = Number(montoAseguradora);
  const valido = Number.isFinite(valor) && valor >= 0 && valor <= monto;
  const copago = valido ? monto - valor : null;

  function abrir() {
    setInsurerId(aseguradoras[0]?.id ?? "");
    setMontoAseguradora(monto.toFixed(2));
    setOpen(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!insurerId) {
      toast.error("Selecciona una aseguradora.");
      return;
    }
    if (!Number.isFinite(valor) || valor < 0 || valor > monto) {
      toast.error(`El monto cubierto debe estar entre 0 y ${fmtPEN(monto)}.`);
      return;
    }
    start(async () => {
      const r = await fetch(`/api/caja/pagos/${pagoId}/aseguradora`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insurerId, monto: valor }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(
          j.error === "monto_excede_pago"
            ? `El monto no puede exceder el pago (${fmtPEN(monto)}).`
            : `No se pudo registrar el split: ${j.error ?? "error"}`,
        );
        return;
      }
      const nombre = aseguradoras.find((a) => a.id === insurerId)?.nombre ?? "aseguradora";
      toast.success(`Split registrado: ${nombre} cubre ${fmtPEN(valor)}.`);
      setOpen(false);
      setTimeout(() => router.refresh(), 300);
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs"
        onClick={abrir}
        disabled={aseguradoras.length === 0}
      >
        <ShieldPlus className="size-3.5" />
        Aseguradora
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Split aseguradora"
        icon={<ShieldPlus className="size-4 text-primary" />}
        description={
          paciente
            ? `Registra cuánto cubre la aseguradora y cuánto queda como copago de ${paciente}.`
            : "Registra cuánto cubre la aseguradora y cuánto queda como copago del paciente."
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Aseguradora</Label>
            {aseguradoras.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay aseguradoras registradas. Créalas en Consola → Aseguradoras.
              </p>
            ) : (
              <Select value={insurerId} onChange={(e) => setInsurerId(e.target.value)}>
                {aseguradoras.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Monto cubierto por la aseguradora (S/)</Label>
            <Input
              type="number"
              min="0"
              max={monto}
              step="0.01"
              value={montoAseguradora}
              onChange={(e) => setMontoAseguradora(e.target.value)}
              className="tabular-nums"
            />
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total del pago</span>
              <span className="font-semibold tabular-nums">{fmtPEN(monto)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Aseguradora</span>
              <span className="font-semibold tabular-nums">
                {valido ? fmtPEN(valor) : "—"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t pt-1">
              <span className="text-muted-foreground">Copago del paciente</span>
              <span className="font-semibold tabular-nums">
                {copago !== null ? fmtPEN(copago) : "—"}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || aseguradoras.length === 0}>
              {pending ? "Guardando…" : "Registrar split"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
