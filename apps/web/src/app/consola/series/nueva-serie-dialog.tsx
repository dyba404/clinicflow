"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Repeat, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fmtPEN } from "@/lib/format";

interface Servicio {
  id: string;
  nombre: string;
  duracionMin: number;
  precio: string;
}

function hoyLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

export function NuevaSerieDialog({
  teamSlug,
  doctores,
  pacientes,
}: {
  teamSlug: string;
  doctores: Array<{ id: string; name: string }>;
  pacientes: Array<{ id: string; nombre: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [frecuencia, setFrecuencia] = useState("semanal");
  const [fechaInicio, setFechaInicio] = useState(hoyLima);
  const [horaIni, setHoraIni] = useState("");
  const [totalSesiones, setTotalSesiones] = useState("6");

  useEffect(() => {
    if (!open || servicios.length > 0) return;
    fetch(`/api/clinicas/${teamSlug}/servicios`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setServicios(j?.servicios ?? []))
      .catch(() => setServicios([]));
  }, [open, teamSlug, servicios.length]);

  function cerrar() {
    setOpen(false);
    setServiceId("");
    setPatientId("");
    setDoctorId("");
    setTitulo("");
    setFrecuencia("semanal");
    setFechaInicio(hoyLima());
    setHoraIni("");
    setTotalSesiones("6");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!serviceId || !patientId || !titulo.trim() || !fechaInicio || !horaIni) {
      toast.error("Completa todos los campos");
      return;
    }
    start(async () => {
      const r = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          serviceId,
          doctorId: doctorId || null,
          titulo: titulo.trim(),
          frecuencia,
          fechaInicio,
          horaIni,
          totalSesiones: Number(totalSesiones),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(`No se pudo crear la serie: ${j.error ?? "error"}`);
        return;
      }
      toast.success(
        `Serie creada: ${j.creadas} citas${j.omitidas > 0 ? `, ${j.omitidas} horarios omitidos por estar ocupados` : ""}`,
      );
      cerrar();
      setTimeout(() => router.refresh(), 300);
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Repeat className="size-4" />
        Nueva serie
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={cerrar} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Repeat className="size-4 text-primary" />
                Nueva serie de citas
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
                <label className="text-xs font-medium text-muted-foreground" htmlFor="serie-titulo">
                  Título
                </label>
                <Input
                  id="serie-titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej. Control de ortodoncia"
                  maxLength={80}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="serie-servicio">
                  Servicio
                </label>
                <Select
                  id="serie-servicio"
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

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="serie-paciente">
                  Paciente
                </label>
                <Select
                  id="serie-paciente"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  required
                >
                  <option value="">Selecciona un paciente…</option>
                  {pacientes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="serie-doctor">
                  Doctor
                </label>
                <Select
                  id="serie-doctor"
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
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="serie-frecuencia">
                    Frecuencia
                  </label>
                  <Select
                    id="serie-frecuencia"
                    value={frecuencia}
                    onChange={(e) => setFrecuencia(e.target.value)}
                  >
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="serie-total">
                    N° de sesiones
                  </label>
                  <Input
                    id="serie-total"
                    type="number"
                    min={2}
                    max={48}
                    value={totalSesiones}
                    onChange={(e) => setTotalSesiones(e.target.value)}
                    className="tabular-nums"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="serie-fecha">
                    Primera cita
                  </label>
                  <Input
                    id="serie-fecha"
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="serie-hora">
                    Hora
                  </label>
                  <Input
                    id="serie-hora"
                    type="time"
                    value={horaIni}
                    onChange={(e) => setHoraIni(e.target.value)}
                    required
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Las citas se crean confirmadas. Si un horario está ocupado, esa sesión se
                omite y se reporta al final.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={cerrar} disabled={pending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  <Plus className="size-4" />
                  Crear serie
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
