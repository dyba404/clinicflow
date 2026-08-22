"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HeartPulse, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const MAX = 1000;

export function EditDialog({
  patientId,
  iniciales,
}: {
  patientId: string;
  iniciales: {
    antecedentes: string | null;
    medicacion: string | null;
    alergias: string | null;
    gestacion: boolean;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [antecedentes, setAntecedentes] = useState(iniciales.antecedentes ?? "");
  const [medicacion, setMedicacion] = useState(iniciales.medicacion ?? "");
  const [alergias, setAlergias] = useState(iniciales.alergias ?? "");
  const [gestacion, setGestacion] = useState(iniciales.gestacion);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    for (const [campo, valor] of [
      ["Alergias", alergias],
      ["Antecedentes", antecedentes],
      ["Medicación", medicacion],
    ] as const) {
      if (valor.length > MAX) {
        toast.error(`${campo} no debe exceder ${MAX} caracteres`);
        return;
      }
    }
    start(async () => {
      const res = await fetch(`/api/pacientes/${patientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ antecedentes, medicacion, alergias, gestacion }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo guardar la ficha: ${j.error ?? "error"}`);
        return;
      }
      toast.success("Ficha actualizada");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-4" />
        Editar ficha
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Antecedentes y alertas"
        icon={<HeartPulse className="size-4 text-primary" />}
        description="Información clínica sensible visible en la ficha del paciente."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ficha-alergias">Alergias</Label>
            <textarea
              id="ficha-alergias"
              className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              rows={2}
              maxLength={MAX}
              placeholder="Penicilina, látex… (o dejar vacío)"
              value={alergias}
              onChange={(e) => setAlergias(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ficha-antecedentes">Antecedentes</Label>
            <textarea
              id="ficha-antecedentes"
              className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              rows={3}
              maxLength={MAX}
              placeholder="Diabetes, hipertensión, cirugías previas…"
              value={antecedentes}
              onChange={(e) => setAntecedentes(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ficha-medicacion">Medicación actual</Label>
            <textarea
              id="ficha-medicacion"
              className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              rows={3}
              maxLength={MAX}
              placeholder="Medicamentos que toma actualmente…"
              value={medicacion}
              onChange={(e) => setMedicacion(e.target.value)}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border p-3">
            <Checkbox
              checked={gestacion}
              onChange={(e) => setGestacion(e.target.checked)}
            />
            <span className="text-sm font-medium">Paciente en gestación</span>
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
