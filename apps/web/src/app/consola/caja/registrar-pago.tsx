"use client";

import { useTransition, type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fmtPEN } from "@/lib/format";

const METODOS = [
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta_pos", label: "Tarjeta POS" },
  { value: "tarjeta_online", label: "Tarjeta online" },
  { value: "otro", label: "Otro" },
] as const;

export function RegistrarPago({
  pacientes,
}: {
  pacientes: Array<{ id: string; nombre: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("yape");
  const [patientId, setPatientId] = useState("");
  const [referencia, setReferencia] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const valor = Number(monto);
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    start(async () => {
      const r = await fetch("/api/caja/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto: valor,
          metodo,
          patientId: patientId || null,
          referencia: referencia || null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(`No se pudo registrar: ${j.error ?? "error"}`);
        return;
      }
      const j = (await r.json().catch(() => ({}))) as {
        comprobante?: { numero: string; estado: string } | null;
      };
      const nombre = pacientes.find((p) => p.id === patientId)?.nombre;
      toast.success(`Pago de ${fmtPEN(valor)} registrado${nombre ? ` · ${nombre}` : ""}`);
      const comp = j.comprobante;
      if (comp) {
        if (comp.estado === "aceptado") {
          toast.success(`Comprobante ${comp.numero} emitido y aceptado por SUNAT.`);
        } else if (comp.estado === "rechazado") {
          toast.error(`SUNAT rechazó ${comp.numero}. Revisa y reemite desde Comprobantes.`);
        } else {
          toast.info(`Comprobante ${comp.numero} quedó pendiente de envío a SUNAT.`);
        }
      }
      setMonto("");
      setReferencia("");
      setTimeout(() => router.refresh(), 300);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="pago-monto">
            Monto (S/)
          </label>
          <Input
            id="pago-monto"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            className="tabular-nums"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="pago-metodo">
            Método
          </label>
          <Select id="pago-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {METODOS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="pago-paciente">
          Paciente (opcional)
        </label>
        <Select
          id="pago-paciente"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
        >
          <option value="">Sin paciente</option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="pago-referencia">
          Referencia (opcional)
        </label>
        <Input
          id="pago-referencia"
          placeholder="YAPE-1234, voucher…"
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        <Plus className="size-4" />
        Registrar pago
      </Button>
    </form>
  );
}
