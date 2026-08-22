"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
};

const ESTADO_LABEL: Record<string, string> = {
  activo: "Activo",
  por_renovar: "Por renovar",
  suspendido: "Suspendido",
  cancelado: "Cancelado",
};

export function PlanEditor({
  tenantId,
  tenantName,
  iniciales,
}: {
  tenantId: string;
  tenantName: string;
  iniciales: {
    plan: string | null;
    estado: string | null;
    vence: string | null;
    monto: string | null;
    nota: string | null;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [plan, setPlan] = useState(iniciales.plan ?? "free");
  const [estado, setEstado] = useState(iniciales.estado ?? "activo");
  const [vence, setVence] = useState(iniciales.vence ?? "");
  const [monto, setMonto] = useState(iniciales.monto ?? "");
  const [nota, setNota] = useState(iniciales.nota ?? "");

  function guardar() {
    start(async () => {
      const res = await fetch("/api/admin/suscripcion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          plan,
          estado,
          vence: vence || null,
          monto: monto === "" ? null : Number(monto),
          nota: nota || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo guardar el plan: ${j.error ?? "error"}`);
        return;
      }
      toast.success(`Plan de ${tenantName} actualizado`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PencilLine className="size-4" />
        Editar plan
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Plan de ${tenantName}`}
        description="Cambios internos del operador. El tenant verá el nuevo estado al instante."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`plan-${tenantId}`}>Plan</Label>
            <Select id={`plan-${tenantId}`} value={plan} onChange={(e) => setPlan(e.target.value)}>
              {Object.entries(PLAN_LABEL).map(([codigo, nombre]) => (
                <option key={codigo} value={codigo}>
                  {nombre}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`estado-${tenantId}`}>Estado</Label>
            <Select id={`estado-${tenantId}`} value={estado} onChange={(e) => setEstado(e.target.value)}>
              {Object.entries(ESTADO_LABEL).map(([codigo, nombre]) => (
                <option key={codigo} value={codigo}>
                  {nombre}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`vence-${tenantId}`}>Vence</Label>
              <Input
                id={`vence-${tenantId}`}
                type="date"
                value={vence}
                onChange={(e) => setVence(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`monto-${tenantId}`}>Monto (S/)</Label>
              <Input
                id={`monto-${tenantId}`}
                type="number"
                min={0}
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`nota-${tenantId}`}>Nota interna</Label>
            <Input
              id={`nota-${tenantId}`}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={200}
              placeholder="Ej. pagó por Yape el 01/08"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={pending}>
            {pending ? "Guardando…" : "Guardar plan"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
