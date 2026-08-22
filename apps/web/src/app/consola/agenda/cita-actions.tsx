"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function CitaActions({
  citaId,
  paciente,
  doctorId,
  fecha,
  horaIni,
  doctores,
}: {
  citaId: string;
  paciente: string;
  doctorId: string | null;
  fecha: string;
  horaIni: string;
  doctores: Array<{ id: string; name: string; color?: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [nFecha, setNFecha] = useState(fecha);
  const [nHora, setNHora] = useState(horaIni.slice(0, 5));
  const [nDoctorId, setNDoctorId] = useState(doctorId ?? "");

  function reprogramar(e: FormEvent) {
    e.preventDefault();
    if (!nFecha || !nHora) {
      toast.error("Completa fecha y hora");
      return;
    }
    start(async () => {
      const r = await fetch(`/api/citas/${citaId}/reprogramar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: nFecha,
          horaIni: nHora,
          doctorId: nDoctorId || null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(
          j.error === "horario_ocupado"
            ? "El horario elegido está ocupado"
            : `No se pudo reprogramar: ${j.error ?? "error"}`,
        );
        return;
      }
      toast.success(`Cita de ${paciente} reprogramada`);
      setOpen(false);
      setTimeout(() => router.refresh(), 300);
    });
  }

  function cancelar() {
    if (!window.confirm(`¿Cancelar la cita de ${paciente}?`)) return;
    start(async () => {
      const r = await fetch(`/api/citas/${citaId}/estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "cancelada" }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(`No se pudo cancelar: ${j.error ?? "error"}`);
        return;
      }
      toast.success(`Cita de ${paciente} cancelada`);
      setTimeout(() => router.refresh(), 300);
    });
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="size-7 [@media(pointer:coarse)]:min-w-12"
          title="Reprogramar"
          aria-label={`Reprogramar cita de ${paciente}`}
          onClick={() => {
            setNFecha(fecha);
            setNHora(horaIni.slice(0, 5));
            setNDoctorId(doctorId ?? "");
            setOpen(true);
          }}
          disabled={pending}
        >
          <CalendarClock className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7 [@media(pointer:coarse)]:min-w-12"
          title="Cancelar"
          aria-label={`Cancelar cita de ${paciente}`}
          onClick={cancelar}
          disabled={pending}
        >
          <X className="size-3.5 text-destructive" />
        </Button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">Reprogramar cita</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cerrar
              </button>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">{paciente}</p>
            <form onSubmit={reprogramar} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor={`reprog-fecha-${citaId}`}>
                    Fecha
                  </label>
                  <Input
                    id={`reprog-fecha-${citaId}`}
                    type="date"
                    value={nFecha}
                    onChange={(e) => setNFecha(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor={`reprog-hora-${citaId}`}>
                    Hora
                  </label>
                  <Input
                    id={`reprog-hora-${citaId}`}
                    type="time"
                    className="tabular-nums"
                    value={nHora}
                    onChange={(e) => setNHora(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor={`reprog-doctor-${citaId}`}>
                  Doctor
                </label>
                <Select
                  id={`reprog-doctor-${citaId}`}
                  value={nDoctorId}
                  onChange={(e) => setNDoctorId(e.target.value)}
                >
                  <option value="">Sin doctor asignado</option>
                  {doctores.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  Cerrar
                </Button>
                <Button type="submit" disabled={pending}>
                  <CalendarClock className="size-4" />
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
