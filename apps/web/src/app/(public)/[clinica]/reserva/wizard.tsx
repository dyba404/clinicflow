"use client";

import { Fragment, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  CalendarClock,
  CalendarIcon,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDotDashed,
  Clock,
  Loader2,
  ShieldMinus,
  Sparkles,
  Stethoscope,
  Syringe,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ServicioItem {
  id: string;
  nombre: string;
  duracionMin: number;
  precio: string;
}

interface DoctorItem {
  membershipId: string;
  name: string;
}

interface Props {
  clinicaSlug: string;
  clinicaName: string;
  servicios: ServicioItem[];
  doctores: DoctorItem[];
}

const PASOS = ["Servicio", "Horario", "Datos"];

function fechaISO(offsetDias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatPrecio(precio: string): string {
  const n = Number(precio);
  return `S/ ${Number.isFinite(n) ? n.toFixed(2) : precio}`;
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

function iconoServicio(nombre: string) {
  const n = nombre.toLowerCase();
  if (n.includes("limpieza")) return Sparkles;
  if (n.includes("extracci")) return ShieldMinus;
  if (n.includes("resina") || n.includes("empaste")) return CircleDotDashed;
  if (n.includes("endodoncia")) return Syringe;
  return Stethoscope;
}

function Stepper({ paso }: { paso: number }) {
  return (
    <div className="mt-8 flex items-start">
      {PASOS.map((label, i) => {
        const num = i + 1;
        const completado = num < paso;
        const actual = num === paso;
        return (
          <Fragment key={label}>
            {i > 0 && (
              <div
                className={cn(
                  "mt-3.5 h-px flex-1 transition-colors",
                  num <= paso ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1.5 px-2">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  completado && "bg-accent text-accent-foreground",
                  actual && "bg-primary text-primary-foreground",
                  !completado && !actual && "border border-border text-muted-foreground",
                )}
              >
                {completado ? <Check className="size-4" /> : num}
              </div>
              <span
                className={cn(
                  "text-xs",
                  actual ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function Pill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors",
        selected
          ? "border-primary bg-accent font-medium text-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/40",
      )}
    >
      {children}
    </button>
  );
}

export function WizardReserva({ clinicaSlug, clinicaName, servicios, doctores }: Props) {
  const [paso, setPaso] = useState(1);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(fechaISO(1));
  const [doctorSel, setDoctorSel] = useState<string>("");
  const [slots, setSlots] = useState<Array<{ startTime: string; endTime: string }> | null>(null);
  const [slotSel, setSlotSel] = useState<{ startTime: string; endTime: string } | null>(null);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ fecha: string; hora: string } | null>(null);

  const servicio = servicios.find((s) => s.id === serviceId) ?? null;
  const doctor = doctores.find((d) => d.membershipId === doctorSel) ?? null;

  async function cargarSlots() {
    if (!serviceId) return;
    setCargandoSlots(true);
    setError(null);
    setSlots(null);
    setSlotSel(null);
    try {
      const q = new URLSearchParams({ serviceId, date: fecha });
      if (doctorSel) q.set("doctorId", doctorSel);
      const r = await fetch(`/api/clinicas/${clinicaSlug}/slots?${q.toString()}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "error_slots");
      setSlots(j.slots ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error_inesperado");
    } finally {
      setCargandoSlots(false);
    }
  }

  async function enviar() {
    if (!serviceId || !slotSel) return;
    if (!consentimiento) {
      setError("Debes aceptar el consentimiento de tratamiento de datos.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch(`/api/clinicas/${clinicaSlug}/solicitudes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          date: fecha,
          startTime: slotSel.startTime,
          endTime: slotSel.endTime,
          doctorMembershipId: doctorSel || null,
          nombre,
          celular,
          email: email || undefined,
          consentimiento,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        throw new Error(
          j.error === "slot_no_disponible"
            ? "Ese horario acaba de ocuparse. Elige otro."
            : j.error ?? "error_envio",
        );
      }
      setResultado({ fecha: j.cita.fecha, hora: `${j.cita.horaIni}–${j.cita.horaFin}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "error_envio");
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent">
              <CheckCircle2 className="size-8 text-primary" />
            </div>
            <h1 className="mt-4 text-xl font-semibold text-foreground">¡Solicitud enviada!</h1>
            <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-foreground tabular-nums">
              {formatFechaLarga(resultado.fecha)} · {resultado.hora} · {servicio?.nombre}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {clinicaName} revisará tu solicitud y confirmará tu cita. Si dejaste tu correo,
              te llegará la confirmación con un enlace para reprogramar o cancelar.
            </p>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Bell className="size-3.5" />
              Te avisaremos apenas esté confirmada
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
        <header className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary">
            <Stethoscope className="size-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{clinicaName}</p>
            <p className="text-sm text-muted-foreground">Reservas en línea</p>
          </div>
        </header>

        <Stepper paso={paso} />

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {paso === 1 && (
          <section className="mt-8 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">¿Qué necesitas?</h2>
              <p className="text-sm text-muted-foreground">
                Elige el servicio y te mostramos horarios disponibles.
              </p>
            </div>
            <div className="space-y-2">
              {servicios.map((s) => {
                const Icon = iconoServicio(s.nombre);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setServiceId(s.id);
                      setPaso(2);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-sm"
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <Icon className="size-4" />
                      </span>
                      <span>
                        <span className="block font-medium text-foreground">{s.nombre}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {s.duracionMin} min
                        </span>
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatPrecio(s.precio)}
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <BadgeCheck className="size-3.5" />
                Sin costo de reserva
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />
                Confirman tu hora el mismo día
              </span>
            </div>
          </section>
        )}

        {paso === 2 && (
          <section className="mt-8 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">¿Cuándo te queda bien?</h2>
              <p className="text-sm text-muted-foreground">
                Elige doctor, fecha y hora para tu cita.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-accent/40 px-3 py-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaso(1)}
                  aria-label="Volver al paso servicio"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <span className="truncate text-sm font-medium text-foreground">
                  {servicio?.nombre}
                </span>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {servicio?.duracionMin} min · {servicio ? formatPrecio(servicio.precio) : ""}
              </span>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">Doctor (opcional)</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Pill
                  selected={doctorSel === ""}
                  onClick={() => {
                    setDoctorSel("");
                    setSlots(null);
                    setSlotSel(null);
                  }}
                >
                  Cualquier doctor
                </Pill>
                {doctores.map((d) => (
                  <Pill
                    key={d.membershipId}
                    selected={doctorSel === d.membershipId}
                    onClick={() => {
                      setDoctorSel(d.membershipId);
                      setSlots(null);
                      setSlotSel(null);
                    }}
                  >
                    <Avatar name={d.name} className="size-6 text-[10px]" />
                    {d.name}
                  </Pill>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fecha" className="text-sm font-medium text-foreground">
                Fecha
              </label>
              <Input
                id="fecha"
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
                <p className="text-sm text-muted-foreground">
                  No hay horarios ese día. Prueba otra fecha.
                </p>
              </div>
            )}

            {slots && slots.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground tabular-nums">
                  {slots.length} horarios disponibles
                </p>
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

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setPaso(1)}>
                Volver
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={!slotSel}
                onClick={() => setPaso(3)}
              >
                Continuar
              </Button>
            </div>
          </section>
        )}

        {paso === 3 && (
          <section className="mt-8 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Tus datos</h2>
              <p className="text-sm text-muted-foreground">
                Confirma tu reserva y te contactamos para la hora exacta.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground">{servicio?.nombre}</p>
                <p className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {servicio ? formatPrecio(servicio.precio) : ""} · se paga en clínica
                </p>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarIcon className="size-4 shrink-0" />
                  <span>{formatFechaLarga(fecha)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="size-4 shrink-0" />
                  <span className="tabular-nums">
                    {slotSel?.startTime}–{slotSel?.endTime}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <UserRound className="size-4 shrink-0" />
                  <span>{doctor ? doctor.name : "Cualquier doctor disponible"}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="space-y-1.5">
                <label htmlFor="nombre" className="text-sm font-medium text-foreground">
                  Nombre completo
                </label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  placeholder="Ej. Elena Torres"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="celular" className="text-sm font-medium text-foreground">
                  Celular (WhatsApp)
                </label>
                <Input
                  id="celular"
                  type="tel"
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                  required
                  placeholder="987654321"
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Correo (opcional)
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={consentimiento}
                  onChange={(e) => setConsentimiento(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className="text-xs text-muted-foreground">
                  Acepto que mis datos se usen para gestionar la cita según la{" "}
                  <a
                    href={`/${clinicaSlug}/privacidad`}
                    target="_blank"
                    rel="noopener"
                    className="text-primary underline"
                  >
                    política de privacidad
                  </a>{" "}
                  y los{" "}
                  <a
                    href={`/${clinicaSlug}/terminos`}
                    target="_blank"
                    rel="noopener"
                    className="text-primary underline"
                  >
                    términos de uso
                  </a>{" "}
                  (Ley 29733 — Protección de datos personales).
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setPaso(2)}>
                Volver
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={enviar}
                disabled={enviando || !nombre.trim() || !celular.trim() || !consentimiento}
              >
                {enviando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  "Enviar solicitud"
                )}
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Sin costo de reserva · La confirma la clínica
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
