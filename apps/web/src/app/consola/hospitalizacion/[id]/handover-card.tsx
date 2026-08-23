"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Handover {
  id: string;
  turno: string;
  resumen: string;
  pendientes: string | null;
  nombreEntrega: string | null;
  nombreRecibe: string | null;
  createdAt: string;
}

interface Miembro {
  userId: string;
  name: string;
}

const TURNO_LABEL: Record<string, string> = {
  manana: "Mañana",
  tarde: "Tarde",
  noche: "Noche",
};

export function HandoverCard({
  admissionId,
  activa,
  handovers,
  miembros,
}: {
  admissionId: string;
  activa: boolean;
  handovers: Handover[];
  miembros: Miembro[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [turno, setTurno] = useState("manana");
  const [recibeUserId, setRecibeUserId] = useState("");
  const [resumen, setResumen] = useState("");
  const [pendientes, setPendientes] = useState("");

  function registrarHandover(e: FormEvent) {
    e.preventDefault();
    if (resumen.trim().length < 10) {
      toast.error("El resumen debe tener al menos 10 caracteres.");
      return;
    }
    setPending(true);
    fetch(`/api/hospitalizacion/${admissionId}/handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        turno,
        resumen: resumen.trim(),
        pendientes: pendientes.trim() || null,
        recibeUserId: recibeUserId || null,
      }),
    })
      .then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          toast.error(
            j.error === "admision_no_activa"
              ? "La admisión ya no está activa."
              : `No se pudo registrar la entrega: ${j.error ?? "error"}`,
          );
          return;
        }
        toast.success("Entrega de turno registrada.");
        setResumen("");
        setPendientes("");
        router.refresh();
      })
      .finally(() => setPending(false));
  }

  return (
    <Card>
      <CardHeader className="p-5 pb-4">
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="size-4 text-primary" />
          Entrega de turno (handover)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0">
        {activa ? (
          <form onSubmit={registrarHandover} className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="w-36 space-y-1.5">
                <Label htmlFor="ho-turno">Turno que entrega</Label>
                <Select id="ho-turno" value={turno} onChange={(e) => setTurno(e.target.value)}>
                  <option value="manana">Mañana</option>
                  <option value="tarde">Tarde</option>
                  <option value="noche">Noche</option>
                </Select>
              </div>
              <div className="min-w-48 flex-1 space-y-1.5">
                <Label htmlFor="ho-recibe">Recibe (opcional)</Label>
                <Select
                  id="ho-recibe"
                  value={recibeUserId}
                  onChange={(e) => setRecibeUserId(e.target.value)}
                >
                  <option value="">Sin especificar</option>
                  {miembros.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ho-resumen">Resumen de la entrega (mínimo 10 caracteres)</Label>
              <Textarea
                id="ho-resumen"
                rows={3}
                value={resumen}
                onChange={(e) => setResumen(e.target.value)}
                placeholder="Estado del paciente, tratamientos en curso, indicaciones…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ho-pendientes">Pendientes (opcional)</Label>
              <Textarea
                id="ho-pendientes"
                rows={2}
                value={pendientes}
                onChange={(e) => setPendientes(e.target.value)}
                placeholder="Tareas o controles que quedan pendientes…"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={pending}>
                <Plus className="size-3.5" />
                Registrar entrega
              </Button>
            </div>
          </form>
        ) : null}

        {handovers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin entregas registradas.</p>
        ) : (
          <ul className="space-y-3">
            {handovers.map((h) => (
              <li key={h.id} className="rounded-lg border px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{TURNO_LABEL[h.turno] ?? h.turno}</span>
                  <span>
                    {h.nombreEntrega ?? "—"}
                    {h.nombreRecibe ? ` → ${h.nombreRecibe}` : ""}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{h.resumen}</p>
                {h.pendientes ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                    Pendientes: {h.pendientes}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
