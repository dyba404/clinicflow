"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fmtPEN } from "@/lib/format";

interface Servicio {
  id: string;
  nombre: string;
  duracionMin: number;
  precio: string;
  bufferMin: number;
}

interface Slot {
  startTime: string;
  endTime: string;
}

const NUEVO = "__nuevo__";

function hoyLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

export function NuevaCitaDialog({
  teamSlug,
  doctores,
  pacientes,
}: {
  teamSlug: string;
  doctores: Array<{ id: string; name: string; color?: string }>;
  pacientes: Array<{ id: string; nombre: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [modoPaciente, setModoPaciente] = useState("");
  const [patientId, setPatientId] = useState("");
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [fecha, setFecha] = useState(hoyLima);
  const [horaIni, setHoraIni] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [cargandoSlots, setCargandoSlots] = useState(false);

  useEffect(() => {
    if (!open || servicios.length > 0) return;
    fetch(`/api/clinicas/${teamSlug}/servicios`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setServicios(j?.servicios ?? []))
      .catch(() => setServicios([]));
  }, [open, teamSlug, servicios.length]);

  useEffect(() => {
    setHoraIni("");
    if (!open || !serviceId || !fecha) {
      setSlots([]);
      return;
    }
    let cancelado = false;
    setCargandoSlots(true);
    const qs = new URLSearchParams({ serviceId, date: fecha });
    if (doctorId) qs.set("doctorId", doctorId);
    fetch(`/api/clinicas/${teamSlug}/slots?${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelado) setSlots(j?.slots ?? []);
      })
      .catch(() => {
        if (!cancelado) setSlots([]);
      })
      .finally(() => {
        if (!cancelado) setCargandoSlots(false);
      });
    return () => {
      cancelado = true;
    };
  }, [open, teamSlug, serviceId, fecha, doctorId]);

  function cerrar() {
    setOpen(false);
    setServiceId("");
    setModoPaciente("");
    setPatientId("");
    setNombre("");
    setCelular("");
    setDoctorId("");
    setFecha(hoyLima());
    setHoraIni("");
    setSlots([]);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!serviceId) {
      toast.error("Elige un servicio");
      return;
    }
    if (!fecha) {
      toast.error("Elige una fecha");
      return;
    }
    if (modoPaciente !== NUEVO && !patientId) {
      toast.error("Elige un paciente");
      return;
    }
    if (!horaIni) {
      toast.error("Elige una hora");
      return;
    }
    const paciente =
      modoPaciente === NUEVO ? { nombre, celular } : { id: patientId };
    start(async () => {
      const r = await fetch("/api/citas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          doctorId: doctorId || null,
          fecha,
          horaIni,
          paciente,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(
          j.error === "horario_ocupado"
            ? "El horario elegido está ocupado"
            : `No se pudo crear la cita: ${j.error ?? "error"}`,
        );
        return;
      }
      toast.success("Cita creada");
      cerrar();
      setTimeout(() => router.refresh(), 300);
    });
  }

  const servicio = servicios.find((s) => s.id === serviceId);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nueva cita
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={cerrar} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <CalendarPlus className="size-4 text-primary" />
                Nueva cita
              </h3>
              <button
                type="button"
                onClick={cerrar}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="cita-servicio">
                  Servicio
                </label>
                <Select
                  id="cita-servicio"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  required
                >
                  <option value="">Selecciona un servicio…</option>
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} · {fmtPEN(Number(s.precio))}
                    </option>
                  ))}
                </Select>
              </div>

              {servicio ? (
                <p className="text-xs text-muted-foreground">
                  Duración: {servicio.duracionMin} min
                </p>
              ) : null}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="cita-paciente">
                  Paciente
                </label>
                <Select
                  id="cita-paciente"
                  value={modoPaciente}
                  onChange={(e) => {
                    setModoPaciente(e.target.value);
                    setPatientId(e.target.value === NUEVO ? "" : e.target.value);
                  }}
                  required
                >
                  <option value="">Selecciona un paciente…</option>
                  {pacientes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                  <option value={NUEVO}>➕ Nuevo paciente</option>
                </Select>
              </div>

              {modoPaciente === NUEVO ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="cita-nombre">
                      Nombre
                    </label>
                    <Input
                      id="cita-nombre"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Nombre completo"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="cita-celular">
                      Celular
                    </label>
                    <Input
                      id="cita-celular"
                      value={celular}
                      onChange={(e) => setCelular(e.target.value)}
                      placeholder="999888777"
                      required
                    />
                  </div>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="cita-doctor">
                  Doctor
                </label>
                <Select
                  id="cita-doctor"
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                >
                  <option value="">Sin doctor asignado</option>
                  {doctores.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="cita-fecha">
                    Fecha
                  </label>
                  <Input
                    id="cita-fecha"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="cita-hora">
                    Hora
                  </label>
                  <Select
                    id="cita-hora"
                    value={horaIni}
                    onChange={(e) => setHoraIni(e.target.value)}
                    disabled={!serviceId || cargandoSlots}
                    required
                  >
                    <option value="">
                      {cargandoSlots ? "Cargando…" : "Elige una hora"}
                    </option>
                    {slots.map((s) => (
                      <option key={s.startTime} value={s.startTime}>
                        {s.startTime} – {s.endTime}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {serviceId && !cargandoSlots && slots.length === 0 ? (
                <p className="text-xs text-amber-600">
                  Sin horarios disponibles para esa combinación.
                </p>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={cerrar} disabled={pending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  <Plus className="size-4" />
                  Crear cita
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
