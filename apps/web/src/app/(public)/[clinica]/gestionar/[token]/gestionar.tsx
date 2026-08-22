"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  CalendarIcon,
  CheckCircle2,
  Clock,
  Loader2,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CitaData {
  clinica: { nombre: string; slug: string };
  paciente: { nombre: string };
  cita: {
    id: string;
    fecha: string;
    horaIni: string;
    horaFin: string;
    estado: string;
    servicio: string | null;
  };
  serviceId: string;
}

function fechaISO(offsetDias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatFechaLarga(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

const ESTADO_LABEL: Record<string, string> = {
  solicitada: "Pendiente de confirmación",
  confirmada: "Confirmada",
  en_espera: "En sala de espera",
  en_atencion: "En atención",
  atendida: "Atendida",
  no_show: "No asistió",
  cancelada: "Cancelada",
};

export function GestionarCita({ token }: { token: string }) {
  const [data, setData] = useState<CitaData | null>(null);
  const [estadoError, setEstadoError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const [modo, setModo] = useState<"ver" | "reprogramar" | "cancelar">("ver");
  const [fecha, setFecha] = useState(fechaISO(1));
  const [slots, setSlots] = useState<Array<{ startTime: string; endTime: string }> | null>(null);
  const [slotSel, setSlotSel] = useState<{ startTime: string; endTime: string } | null>(null);
  const [cargandoSlots, setCargandoSlots] = useState(false);

  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setEstadoError(null);
    try {
      const r = await fetch(`/api/gestionar/${token}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "no_encontrado");
      setData(j);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "no_encontrado";
      setEstadoError(
        msg === "expirado"
          ? "Este enlace ya expiró. Pide a la clínica uno nuevo."
          : msg === "revocado"
            ? "Este enlace fue revocado."
            : "No encontramos tu cita con este enlace.",
      );
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function cargarSlots() {
    if (!data) return;
    setCargandoSlots(true);
    setSlots(null);
    setSlotSel(null);
    try {
      const q = new URLSearchParams({ serviceId: data.serviceId, date: fecha });
      const r = await fetch(`/api/clinicas/${data.clinica.slug}/slots?${q.toString()}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "error_slots");
      setSlots(j.slots ?? []);
    } catch {
      setSlots([]);
    } finally {
      setCargandoSlots(false);
    }
  }

  async function reprogramar() {
    if (!data || !slotSel) return;
    setProcesando(true);
    setError(null);
    try {
      const r = await fetch(`/api/gestionar/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "reprogramar", fecha, horaIni: slotSel.startTime }),
      });
      const j = await r.json();
      if (!r.ok) {
        throw new Error(
          j.error === "horario_ocupado" ? "Ese horario acaba de ocuparse. Elige otro." : j.error ?? "error",
        );
      }
      setResultado("Cita reprogramada con éxito.");
      setModo("ver");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setProcesando(false);
    }
  }

  async function cancelar() {
    if (!data) return;
    setProcesando(true);
    setError(null);
    try {
      const r = await fetch(`/api/gestionar/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "cancelar" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "error");
      setResultado("Cita cancelada.");
      setModo("ver");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setProcesando(false);
    }
  }

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (estadoError || !data) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
              <XCircle className="size-8 text-muted-foreground" />
            </div>
            <h1 className="mt-4 text-xl font-semibold text-foreground">Enlace no válido</h1>
            <p className="mt-2 text-sm text-muted-foreground">{estadoError ?? "Error"}</p>
          </div>
        </div>
      </main>
    );
  }

  const { clinica, paciente, cita } = data;
  const puedeEditar = cita.estado === "solicitada" || cita.estado === "confirmada";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
        <header className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary">
            <Stethoscope className="size-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{clinica.nombre}</p>
            <p className="text-sm text-muted-foreground">Gestiona tu cita</p>
          </div>
        </header>

        {resultado && (
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            <CheckCircle2 className="size-4 shrink-0" />
            {resultado}
          </div>
        )}
        {error && (
          <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Hola, <span className="font-medium text-foreground">{paciente.nombre}</span>
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarIcon className="size-4 shrink-0" />
              <span>{formatFechaLarga(cita.fecha)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground tabular-nums">
              <Clock className="size-4 shrink-0" />
              <span>
                {cita.horaIni}–{cita.horaFin}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Stethoscope className="size-4 shrink-0" />
              <span>{cita.servicio ?? "Servicio"}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Estado: <span className="font-medium text-foreground">{ESTADO_LABEL[cita.estado] ?? cita.estado}</span>
          </p>
        </div>

        {!puedeEditar && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Esta cita ya no se puede reprogramar ni cancelar desde aquí. Si necesitas ayuda,
            contacta a {clinica.nombre}.
          </p>
        )}

        {puedeEditar && modo === "ver" && (
          <div className="mt-6 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setModo("cancelar")}>
              Cancelar cita
            </Button>
            <Button type="button" className="flex-1" onClick={() => setModo("reprogramar")}>
              Reprogramar
            </Button>
          </div>
        )}

        {puedeEditar && modo === "reprogramar" && (
          <section className="mt-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground">Nueva fecha y hora</h2>
            <div className="space-y-1.5">
              <label htmlFor="g-fecha" className="text-sm font-medium text-foreground">
                Fecha
              </label>
              <Input
                id="g-fecha"
                type="date"
                value={fecha}
                min={fechaISO(0)}
                onChange={(e) => {
                  setFecha(e.target.value);
                  setSlots(null);
                  setSlotSel(null);
                }}
                className="tabular-nums"
              />
            </div>
            <Button type="button" className="w-full" onClick={cargarSlots} disabled={cargandoSlots}>
              {cargandoSlots ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Buscando horarios…
                </>
              ) : (
                "Ver horarios disponibles"
              )}
            </Button>

            {slots && slots.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
                <CalendarClock className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No hay horarios ese día. Prueba otra fecha.</p>
              </div>
            )}

            {slots && slots.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((s) => (
                    <button
                      key={s.startTime}
                      type="button"
                      onClick={() => setSlotSel(s)}
                      className={cn(
                        "h-10 rounded-lg border text-sm tabular-nums transition-colors",
                        slotSel?.startTime === s.startTime
                          ? "border-primary bg-primary font-medium text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-primary/50",
                      )}
                    >
                      {s.startTime}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setModo("ver")}>
                Volver
              </Button>
              <Button type="button" className="flex-1" disabled={!slotSel || procesando} onClick={reprogramar}>
                {procesando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  "Confirmar reprogramación"
                )}
              </Button>
            </div>
          </section>
        )}

        {puedeEditar && modo === "cancelar" && (
          <section className="mt-6 space-y-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">
                ¿Seguro que quieres cancelar tu cita del {formatFechaLarga(cita.fecha)} a las{" "}
                {cita.horaIni}? Esta acción libera el horario.
              </p>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setModo("ver")}>
                Volver
              </Button>
              <Button type="button" className="flex-1" variant="outline" onClick={cancelar} disabled={procesando}>
                {procesando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Cancelando…
                  </>
                ) : (
                  "Sí, cancelar mi cita"
                )}
              </Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
