"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Doctor = { id: string; name: string };

export function BloquearDialog({
  fechaISO,
  doctores,
  esDoctor,
}: {
  fechaISO: string;
  doctores: Doctor[];
  esDoctor: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [doctorId, setDoctorId] = useState(doctores[0]?.id ?? "");
  const [horaIni, setHoraIni] = useState("13:00");
  const [horaFin, setHoraFin] = useState("14:00");
  const [motivo, setMotivo] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!doctorId) {
      toast.error("Selecciona un doctor para el bloqueo.");
      return;
    }
    if (horaIni >= horaFin) {
      toast.error("La hora de inicio debe ser menor que la de fin.");
      return;
    }
    start(async () => {
      const res = await fetch("/api/bloqueos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: fechaISO,
          horaIni,
          horaFin,
          motivo: motivo.trim() || null,
          doctorId,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          j.error === "hay_citas_en_el_rango"
            ? "Hay citas en ese rango. Elige otro horario."
            : `No se pudo crear el bloqueo: ${j.error ?? "error"}`,
        );
        return;
      }
      toast.success("Horario bloqueado.");
      setOpen(false);
      setMotivo("");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={!esDoctor && doctores.length === 0}
      >
        <Ban className="size-4" />
        Bloquear
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Bloquear horario"
        description="El bloque aparecerá en la agenda y quedará fuera de la reserva pública."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bloque-doctor">Doctor</Label>
            <Select
              id="bloque-doctor"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            >
              {doctores.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bloque-ini">Desde</Label>
              <Input
                id="bloque-ini"
                type="time"
                value={horaIni}
                onChange={(e) => setHoraIni(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bloque-fin">Hasta</Label>
              <Input
                id="bloque-fin"
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bloque-motivo">Motivo (opcional)</Label>
            <Input
              id="bloque-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Almuerzo, descanso, equipo en mantenimiento…"
              maxLength={120}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Bloqueando…" : "Bloquear horario"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
