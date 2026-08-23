"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarCheck2,
  CalendarIcon,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  FlaskConical,
  HeartPulse,
  Loader2,
  Pill,
  QrCode,
  Receipt,
  ShieldCheck,
  Stethoscope,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtPEN } from "@/lib/format";

interface ProximaCita {
  id: string;
  fecha: string;
  horaIni: string;
  horaFin: string;
  estado: string;
  servicio: string | null;
  doctor: string | null;
  serviceId: string | null;
  doctorId: string | null;
  instruccionesPre: string | null;
  instruccionesPost: string | null;
  puedeConfirmar: boolean;
}

interface CitaHistorial {
  id: string;
  fecha: string;
  horaIni: string;
  estado: string;
  servicio: string | null;
  doctor: string | null;
}

interface Cuota {
  id: string;
  concepto: string;
  n: number;
  monto: string;
  saldo: string;
  vence: string | null;
  estado: string;
}

interface Comprobante {
  id: string;
  tipo: string;
  numero: string;
  emitidaAt: string | null;
}

interface Presupuesto {
  id: string;
  titulo: string;
  total: string;
  estado: string;
}

interface Consentimiento {
  servicioNombre: string | null;
  signedBy: string;
  signedAt: string;
}

interface ResultadoParametro {
  parametro: string;
  valorText: string | null;
  valorNum: string | null;
  unidad: string | null;
  referencia: string | null;
  flag: string | null;
}

interface Resultado {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
  resultadoAt: string | null;
  parametros: ResultadoParametro[];
}

interface ConsultaDiagnostico {
  codigo: string;
  descripcion: string;
  esPrincipal: boolean;
}

interface ConsultaReceta {
  medicamento: string;
  dosis: string | null;
  frecuencia: string | null;
  duracionDias: number | null;
  indicaciones: string | null;
}

interface Consulta {
  id: string;
  fecha: string | null;
  doctor: string | null;
  motivo: string | null;
  plan: string | null;
  notaCompleta: { subjetivo: string | null; objetivo: string | null; evaluacion: string | null } | null;
  diagnosticos: ConsultaDiagnostico[];
  recetas: ConsultaReceta[];
}

interface Salud {
  alergias: string | null;
  antecedentes: string | null;
  medicacion: string | null;
  gestacion: boolean;
}

interface CitaACargo {
  id: string;
  fecha: string;
  horaIni: string;
  horaFin: string;
  estado: string;
  servicio: string | null;
  doctor: string | null;
}

interface PacienteACargo {
  id: string;
  nombre: string;
  proximasCitas: CitaACargo[];
}

interface PortalData {
  clinica: { nombre: string; slug: string };
  paciente: { nombre: string; celular: string | null; salud: Salud | null };
  aCargo: PacienteACargo[];
  proximasCitas: ProximaCita[];
  historial: CitaHistorial[];
  cuotasPendientes: Cuota[];
  comprobantes: Comprobante[];
  presupuestos: Presupuesto[];
  consentimientos: Consentimiento[];
  resultados: Resultado[];
  consultas: Consulta[];
}

interface PagoQr {
  qr: string;
  ref: string;
  monto: string;
  metodo: string;
  numeroYape: string | null;
  clinica: string;
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

function formatFechaLarga(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function PortalPaciente({ token, conSesion = false }: { token: string; conSesion?: boolean }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [estadoError, setEstadoError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagoCuota, setPagoCuota] = useState<Cuota | null>(null);
  const [pagoQr, setPagoQr] = useState<PagoQr | null>(null);
  const [generandoQr, setGenerandoQr] = useState(false);
  const [erroresQr, setErroresQr] = useState<Record<string, boolean>>({});

  const cargar = useCallback(async () => {
    setCargando(true);
    setEstadoError(null);
    try {
      const r = await fetch(`/api/portal/${token}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "token_invalido");
      setData(j);
    } catch {
      setEstadoError(
        "Este enlace no es válido, ya expiró o fue revocado. Pide a la clínica uno nuevo.",
      );
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function confirmarAsistencia(citaId: string) {
    setError(null);
    setMensaje(null);
    try {
      const r = await fetch(`/api/portal/${token}/confirmar-asistencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citaId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "error");
      setMensaje("¡Gracias! Confirmaste tu asistencia. Nos vemos pronto.");
      await cargar();
    } catch {
      setError("No se pudo confirmar la asistencia. Intenta nuevamente.");
    }
  }

  async function pagarCuota(cuota: Cuota, metodo: string) {
    setError(null);
    setMensaje(null);
    setGenerandoQr(true);
    try {
      const r = await fetch(`/api/portal/${token}/pagar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuotaId: cuota.id, metodo }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "error");
      setErroresQr((prev) => ({ ...prev, [cuota.id]: false }));
      setPagoCuota(cuota);
      setPagoQr(j);
    } catch {
      setErroresQr((prev) => ({ ...prev, [cuota.id]: true }));
    } finally {
      setGenerandoQr(false);
    }
  }

  function cerrarPago() {
    setPagoCuota(null);
    setPagoQr(null);
    void cargar();
  }

  async function cancelarCita(citaId: string) {
    setError(null);
    setMensaje(null);
    try {
      const r = await fetch(`/api/portal/${token}/citas/${citaId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "cancelar" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "error");
      setMensaje("Cancelaste tu cita. Si la necesitas, agenda una nueva cuando gustes.");
      await cargar();
    } catch {
      setError("No se pudo cancelar la cita. Intenta nuevamente.");
    }
  }

  async function reprogramarCita(citaId: string, fecha: string, horaIni: string) {
    setError(null);
    setMensaje(null);
    try {
      const r = await fetch(`/api/portal/${token}/citas/${citaId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "reprogramar", fecha, horaIni }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "error");
      setMensaje("Reprogramamos tu cita con éxito.");
      await cargar();
    } catch {
      setError("No se pudo reprogramar la cita. Intenta nuevamente.");
    }
  }

  async function cerrarSesion() {
    try {
      await fetch("/api/portal/auth/logout", { method: "POST" });
    } finally {
      window.location.href = `/${data?.clinica.slug ?? ""}/portal`;
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

function SaludFila({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-none last:pb-0">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{etiqueta}</span>
      <span className="whitespace-pre-line text-right text-sm text-foreground">{valor || "—"}</span>
    </div>
  );
}

function ProgramarCita({
  cita,
  slug,
  onReprogramar,
  onCancelar,
}: {
  cita: ProximaCita;
  slug: string;
  onReprogramar: (citaId: string, fecha: string, horaIni: string) => Promise<void>;
  onCancelar: (citaId: string) => Promise<void>;
}) {
  const [mostrar, setMostrar] = useState<"ninguno" | "reprogramar" | "cancelar">("ninguno");
  const [fecha, setFecha] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [accionando, setAccionando] = useState(false);

  async function abrirReprogramar() {
    if (mostrar === "reprogramar") {
      setMostrar("ninguno");
      return;
    }
    setMostrar("reprogramar");
  }

  async function buscarSlots(nuevaFecha: string) {
    setFecha(nuevaFecha);
    if (!nuevaFecha) {
      setSlots([]);
      return;
    }
    setCargandoSlots(true);
    try {
      const parametros = new URLSearchParams({
        serviceId: cita.serviceId ?? "",
        date: nuevaFecha,
      });
      if (cita.doctorId) parametros.set("doctorId", cita.doctorId);
      const r = await fetch(`/api/clinicas/${slug}/slots?${parametros.toString()}`);
      const j = (await r.json().catch(() => ({}))) as { slots?: Array<{ startTime: string }> };
      setSlots((j.slots ?? []).map((s) => s.startTime));
    } finally {
      setCargandoSlots(false);
    }
  }

  async function confirmarReprogramar() {
    const horaIni = document.getElementById("slot-select") as HTMLSelectElement | null;
    if (!fecha || !horaIni?.value) return;
    setAccionando(true);
    try {
      await onReprogramar(cita.id, fecha, horaIni.value);
      setMostrar("ninguno");
      setFecha("");
      setSlots([]);
    } finally {
      setAccionando(false);
    }
  }

  async function confirmarCancelar() {
    setAccionando(true);
    try {
      await onCancelar(cita.id);
      setMostrar("ninguno");
    } finally {
      setAccionando(false);
    }
  }

  if (mostrar === "cancelar") {
    return (
      <div className="mt-3 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
        <p className="text-sm text-red-700">¿Seguro que quieres cancelar esta cita?</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={accionando}
            onClick={() => void confirmarCancelar()}
          >
            Sí, cancelar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setMostrar("ninguno")}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  if (mostrar === "reprogramar") {
    return (
      <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/40 p-3">
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="fecha-reprogramar">
          Nueva fecha
        </label>
        <input
          id="fecha-reprogramar"
          type="date"
          className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={fecha}
          onChange={(e) => void buscarSlots(e.target.value)}
        />
        {cargandoSlots ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Cargando horarios…
          </p>
        ) : slots.length > 0 ? (
          <select
            id="slot-select"
            className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {slots.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-muted-foreground">Sin horarios para esa fecha.</p>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={accionando || slots.length === 0}
            onClick={() => void confirmarReprogramar()}
          >
            Confirmar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setMostrar("ninguno")}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex gap-2">
      <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => void abrirReprogramar()}>
        <CalendarIcon className="size-3.5" />
        Reprogramar
      </Button>
      <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setMostrar("cancelar")}>
        Cancelar
      </Button>
    </div>
  );
}

  const { clinica, paciente } = data;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
        <header className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary">
            <Stethoscope className="size-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{clinica.nombre}</p>
            <p className="text-sm text-muted-foreground">
              Hola, <span className="font-medium text-foreground">{paciente.nombre}</span>
            </p>
          </div>
          {conSesion && (
            <button
              type="button"
              onClick={() => void cerrarSesion()}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Cerrar sesión
            </button>
          )}
        </header>

        <a
          href={`/${clinica.slug}/reserva${
            data.paciente.celular
              ? `?nombre=${encodeURIComponent(paciente.nombre)}&celular=${encodeURIComponent(data.paciente.celular)}`
              : ""
          }`}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <CalendarIcon className="size-4" />
          Agendar nueva cita
        </a>

        {mensaje && (
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            <CheckCircle2 className="size-4 shrink-0" />
            {mensaje}
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {data.proximasCitas.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <CalendarCheck2 className="size-5 text-primary" />
              Tus próximas citas
            </h2>            <div className="mt-3 space-y-3">
              {data.proximasCitas.map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{c.servicio ?? "Servicio"}</p>
                      {c.doctor && (
                        <p className="truncate text-xs text-muted-foreground">{c.doctor}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                      {ESTADO_LABEL[c.estado] ?? c.estado}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarIcon className="size-4 shrink-0" />
                      <span>{formatFechaLarga(c.fecha)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground tabular-nums">
                      <Clock className="size-4 shrink-0" />
                      <span>
                        {c.horaIni}–{c.horaFin}
                      </span>
                    </div>
                  </div>
                  {c.instruccionesPre && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-800">Antes de tu cita</p>
                      <p className="mt-1 whitespace-pre-line text-xs text-amber-700">{c.instruccionesPre}</p>
                    </div>
                  )}
                  {c.instruccionesPost && (
                    <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 p-3">
                      <p className="text-xs font-semibold text-sky-800">Después de tu cita</p>
                      <p className="mt-1 whitespace-pre-line text-xs text-sky-700">{c.instruccionesPost}</p>
                    </div>
                  )}
                  {c.puedeConfirmar && (
                    <Button
                      type="button"
                      className="mt-4 w-full"
                      onClick={() => void confirmarAsistencia(c.id)}
                    >
                      Confirmar mi asistencia
                    </Button>
                  )}
                  <ProgramarCita cita={c} slug={clinica.slug} onReprogramar={reprogramarCita} onCancelar={cancelarCita} />
                </div>
              ))}
            </div>
          </section>
        )}

        {data.aCargo.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Users className="size-5 text-primary" />
              Pacientes a tu cargo
            </h2>
            <div className="mt-3 space-y-3">
              {data.aCargo.map((p) => (
                <div key={p.id} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-medium text-foreground">{p.nombre}</p>
                  {p.proximasCitas.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">Sin citas próximas.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {p.proximasCitas.map((c) => (
                        <div key={c.id} className="rounded-lg bg-muted/40 p-3 text-sm">
                          <p className="font-medium text-foreground">{c.servicio ?? "Servicio"}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                            {formatFechaLarga(c.fecha)} · {c.horaIni}–{c.horaFin}
                          </p>
                          {c.doctor && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{c.doctor}</p>
                          )}
                          <span className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                            {ESTADO_LABEL[c.estado] ?? c.estado}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.cuotasPendientes.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Wallet className="size-5 text-primary" />
              Cuotas por pagar
            </h2>
            <div className="mt-3 space-y-3">
              {data.cuotasPendientes.map((cuota) => (
                <div key={cuota.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 font-medium text-foreground">
                      {cuota.concepto}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        · cuota {cuota.n}
                      </span>
                    </p>
                    <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                      {fmtPEN(Number(cuota.saldo))}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {cuota.vence ? `Vence: ${cuota.vence}` : "Sin fecha de vencimiento"}
                  </p>
                  <Button
                    type="button"
                    className="mt-4 w-full"
                    onClick={() => void pagarCuota(cuota, "yape")}
                    disabled={generandoQr}
                  >
                    {generandoQr ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Generando…
                      </>
                    ) : (
                      <>
                        <QrCode className="size-4" />
                        Pagar con QR
                      </>
                    )}
                  </Button>
                  {erroresQr[cuota.id] && (
                    <p className="mt-2 text-xs text-red-600">
                      No se pudo generar el QR. Intenta nuevamente.
                    </p>
                  )}
                  {pagoCuota?.id === cuota.id && pagoQr && (
                    <div className="mt-4 rounded-xl border border-accent bg-accent/40 p-4">
                      <div className="flex flex-col items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element -- QR generado al vuelo (data: base64); next/image no optimiza data URLs */}
                        <img
                          src={pagoQr.qr}
                          alt="QR de pago"
                          width={280}
                          height={280}
                          className="size-56 rounded-lg bg-white p-2"
                        />
                        <div className="text-center text-sm">
                          <p className="font-medium text-foreground">
                            Escanea con Yape o Plin y paga {fmtPEN(Number(pagoQr.monto))}
                          </p>
                          {pagoQr.numeroYape && (
                            <p className="mt-1 text-muted-foreground tabular-nums">
                              o transfiere al{" "}
                              <span className="font-semibold">{pagoQr.numeroYape}</span>
                            </p>
                          )}
                          <p className="mt-1 text-muted-foreground">
                            Referencia: <span className="font-semibold">{pagoQr.ref}</span>
                          </p>
                        </div>
                        <p className="text-center text-xs text-muted-foreground">
                          Tu pago quedará registrado como &quot;por verificar&quot; hasta que la
                          clínica lo confirme.
                        </p>
                        <Button type="button" variant="outline" size="sm" onClick={cerrarPago}>
                          Ya pagué / cerrar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.comprobantes.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Receipt className="size-5 text-primary" />
              Tus comprobantes
            </h2>
            <div className="mt-3 space-y-2">
              {data.comprobantes.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{c.numero}</p>
                    <p className="text-xs capitalize text-muted-foreground">{c.tipo}</p>
                  </div>
                  <a
                    href={`/api/portal/${token}/comprobantes/${c.id}/pdf`}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    <Download className="size-3.5" />
                    PDF
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.presupuestos.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <FileText className="size-5 text-primary" />
              Presupuestos
            </h2>
            <div className="mt-3 space-y-2">
              {data.presupuestos.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.estado === "enviado" ? "Enviado por la clínica" : "Aprobado"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                    {fmtPEN(Number(p.total))}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.resultados.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <FlaskConical className="size-5 text-primary" />
              Tus resultados
            </h2>
            <div className="mt-3 space-y-3">
              {data.resultados.map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{r.nombre}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {r.tipo} · {r.estado === "entregada" ? "Entregado" : "Liberado"}
                      </p>
                    </div>
                    <a
                      href={`/api/portal/${token}/resultados/${r.id}/pdf`}
                      className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      <Download className="size-3.5" />
                      PDF
                    </a>
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    {r.parametros.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin resultados detallados.</p>
                    ) : (
                      r.parametros.slice(0, 8).map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 border-b border-border/60 pb-1 last:border-none last:pb-0"
                        >
                          <span className="text-muted-foreground">{p.parametro}</span>
                          <span className="font-medium tabular-nums">
                            {p.valorText ?? (p.valorNum !== null ? String(Number(p.valorNum)) : "")}
                            {p.unidad ? ` ${p.unidad}` : ""}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.consultas.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <HeartPulse className="size-5 text-primary" />
              Tus consultas
            </h2>
            <div className="mt-3 space-y-3">
              {data.consultas.map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{c.motivo ?? "Consulta"}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.fecha ? new Date(c.fecha).toLocaleDateString("es-PE") : ""}
                        {c.doctor ? ` · ${c.doctor}` : ""}
                      </p>
                    </div>
                  </div>
                  {c.diagnosticos.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">Diagnósticos</p>
                      {c.diagnosticos.map((d) => (
                        <div key={d.codigo} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-foreground">{d.descripcion}</span>
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                            {d.codigo}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {c.plan && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-muted-foreground">Plan</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-foreground">{c.plan}</p>
                    </div>
                  )}
                  {c.notaCompleta && (
                    <div className="mt-3 space-y-2 rounded-lg bg-muted/40 p-3">
                      {c.notaCompleta.subjetivo && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">Subjetivo</p>
                          <p className="mt-0.5 whitespace-pre-line text-sm text-foreground">{c.notaCompleta.subjetivo}</p>
                        </div>
                      )}
                      {c.notaCompleta.objetivo && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">Objetivo</p>
                          <p className="mt-0.5 whitespace-pre-line text-sm text-foreground">{c.notaCompleta.objetivo}</p>
                        </div>
                      )}
                      {c.notaCompleta.evaluacion && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">Evaluación</p>
                          <p className="mt-0.5 whitespace-pre-line text-sm text-foreground">{c.notaCompleta.evaluacion}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {c.recetas.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <Pill className="size-3.5" />
                        Recetas
                      </p>
                      {c.recetas.map((r, i) => (
                        <div key={i} className="rounded-lg border border-border p-3">
                          <p className="text-sm font-medium text-foreground">{r.medicamento}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {[r.dosis, r.frecuencia, r.duracionDias ? `${r.duracionDias} días` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {r.indicaciones && (
                            <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{r.indicaciones}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.paciente.salud && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <ShieldCheck className="size-5 text-primary" />
              Mi información de salud
            </h2>
            <div className="mt-3 space-y-2 rounded-xl border border-border bg-card p-4">
              <SaludFila etiqueta="Alergias" valor={data.paciente.salud.alergias} />
              <SaludFila etiqueta="Antecedentes" valor={data.paciente.salud.antecedentes} />
              <SaludFila etiqueta="Medicación actual" valor={data.paciente.salud.medicacion} />
              {data.paciente.salud.gestacion && (
                <SaludFila etiqueta="Gestación" valor="Sí" />
              )}
              <p className="pt-1 text-xs text-muted-foreground">
                Si algún dato está desactualizado, avísanos en tu próxima visita.
              </p>
            </div>
          </section>
        )}

        {data.consentimientos.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <ShieldCheck className="size-5 text-primary" />
              Consentimientos firmados
            </h2>
            <div className="mt-3 space-y-2">
              {data.consentimientos.map((c, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-sm font-medium text-foreground">
                    {c.servicioNombre ?? "Consentimiento de datos"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Firmado por {c.signedBy} ·{" "}
                    {new Date(c.signedAt).toLocaleDateString("es-PE")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.historial.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <CalendarIcon className="size-5 text-primary" />
              Historial de citas
            </h2>
            <div className="mt-3 space-y-2">
              {data.historial.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {c.servicio ?? "Servicio"}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {c.fecha} · {c.horaIni}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      c.estado === "atendida"
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {ESTADO_LABEL[c.estado] ?? c.estado}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Enlace personal y seguro · válido por 30 días
        </p>
        {data.clinica?.slug ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            <a href={`/${data.clinica.slug}/privacidad`} className="underline">
              Política de privacidad
            </a>
            {" · "}
            <a href={`/${data.clinica.slug}/terminos`} className="underline">
              Términos de uso
            </a>
          </p>
        ) : null}
      </div>
    </main>
  );
}
