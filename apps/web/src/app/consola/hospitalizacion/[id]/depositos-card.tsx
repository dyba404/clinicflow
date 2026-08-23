"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Wallet, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface Deposito {
  id: string;
  montoNum: number;
  metodo: string;
  referencia: string | null;
  nota: string | null;
  anuladoAt: string | null;
  nombreRegistro: string | null;
  createdAt: string;
}

interface Factura {
  id: string;
  totalNum: number;
  estado: string;
}

const METODO_LABEL: Record<string, string> = {
  yape: "Yape",
  plin: "Plin",
  efectivo: "Efectivo",
  tarjeta_pos: "Tarjeta POS",
  tarjeta_online: "Tarjeta online",
  otro: "Otro",
};

const ESTADO_FACTURA_LABEL: Record<string, string> = {
  borrador: "Borrador",
  emitida: "Emitida",
  pagada: "Pagada",
};

function soles(n: number): string {
  return `S/ ${n.toFixed(2)}`;
}

export function DepositosCard({
  admissionId,
  activa,
  depositos,
  facturas,
  facturado,
  depositado,
  saldo,
}: {
  admissionId: string;
  activa: boolean;
  depositos: Deposito[];
  facturas: Factura[];
  facturado: number;
  depositado: number;
  saldo: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [referencia, setReferencia] = useState("");

  function registrarDeposito(e: FormEvent) {
    e.preventDefault();
    const n = Number(monto);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Ingresa un monto válido.");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/hospitalizacion/${admissionId}/depositos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto: n, metodo, referencia: referencia.trim() || null }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(
          j.error === "admision_no_activa"
            ? "La admisión ya no está activa."
            : `No se pudo registrar el depósito: ${j.error ?? "error"}`,
        );
        return;
      }
      toast.success("Depósito registrado.");
      setMonto("");
      setReferencia("");
      router.refresh();
    });
  }

  function anularDeposito(id: string) {
    if (!window.confirm("¿Anular este depósito? El pago asociado también se anulará.")) {
      return;
    }
    start(async () => {
      const res = await fetch(`/api/hospitalizacion/${admissionId}/depositos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositoId: id }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(`No se pudo anular: ${j.error ?? "error"}`);
        return;
      }
      toast.success("Depósito anulado.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="p-5 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4 text-primary" />
          Depósitos y liquidación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border px-3 py-2">
            <p className="text-xs text-muted-foreground">Facturado</p>
            <p className="text-sm font-semibold tabular-nums">{soles(facturado)}</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <p className="text-xs text-muted-foreground">Depositado</p>
            <p className="text-sm font-semibold tabular-nums">{soles(depositado)}</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p
              className={`text-sm font-semibold tabular-nums ${
                saldo > 0 ? "text-amber-700" : "text-emerald-700"
              }`}
            >
              {soles(saldo)}
            </p>
          </div>
        </div>

        {facturas.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Facturas de la admisión
            </p>
            <ul className="space-y-1">
              {facturas.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="tabular-nums">{soles(f.totalNum)}</span>
                  <Badge variant={f.estado === "pagada" ? "green" : "gray"}>
                    {ESTADO_FACTURA_LABEL[f.estado] ?? f.estado}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sin facturas vinculadas a esta admisión todavía.
          </p>
        )}

        {activa ? (
          <form onSubmit={registrarDeposito} className="space-y-3 border-t border-border-subtle pt-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-28 space-y-1.5">
                <Label htmlFor="dep-monto">Monto</Label>
                <Input
                  id="dep-monto"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                />
              </div>
              <div className="w-40 space-y-1.5">
                <Label htmlFor="dep-metodo">Método</Label>
                <Select id="dep-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="yape">Yape</option>
                  <option value="plin">Plin</option>
                  <option value="tarjeta_pos">Tarjeta POS</option>
                  <option value="tarjeta_online">Tarjeta online</option>
                  <option value="otro">Otro</option>
                </Select>
              </div>
              <div className="min-w-40 flex-1 space-y-1.5">
                <Label htmlFor="dep-referencia">Referencia (opcional)</Label>
                <Input
                  id="dep-referencia"
                  placeholder="N° de operación"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm" disabled={pending}>
                <Plus className="size-3.5" />
                Depósito
              </Button>
            </div>
          </form>
        ) : null}

        {depositos.length > 0 ? (
          <ul className="space-y-2">
            {depositos.map((d) => (
              <li
                key={d.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                  d.anuladoAt ? "opacity-50" : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium tabular-nums">
                    {soles(d.montoNum)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {METODO_LABEL[d.metodo] ?? d.metodo}
                    {d.referencia ? ` · ${d.referencia}` : ""}
                    {d.nombreRegistro ? ` · ${d.nombreRegistro}` : ""}
                  </span>
                </span>
                {d.anuladoAt ? (
                  <Badge variant="red">Anulado</Badge>
                ) : activa ? (
                  <button
                    type="button"
                    onClick={() => anularDeposito(d.id)}
                    disabled={pending}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Anular depósito"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sin depósitos registrados.</p>
        )}
      </CardContent>
    </Card>
  );
}
