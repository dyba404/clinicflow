"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DoorOpen, ListChecks, PlusCircle, Scissors } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/console/empty-state";

export interface SalaFila {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface CirugiaFila {
  id: string;
  nombrePaciente: string;
  roomId: string | null;
  nombreSala: string | null;
  hora: string;
  procedimiento: string;
  cirujanoNombre: string | null;
  asaClase: string | null;
  estado: "programada" | "intra" | "urpa" | "completada" | "cancelada";
  checklistPreop: boolean[] | null;
  canceladaMotivo: string | null;
}

export interface DoctorOpcion {
  id: string;
  nombre: string;
}

interface PacienteOpcion {
  id: string;
  nombre: string;
  celular: string;
}

export const CHECKLIST_LABELS = [
  "Identidad del paciente confirmada",
  "Consentimiento informado firmado",
  "Sitio quirúrgico marcado",
  "Profilaxis antibiótica",
  "Ayuno mínimo 8 horas",
  "Equipo completo asignado",
];

const ESTADO_LABEL: Record<string, string> = {
  programada: "Programada",
  intra: "Intraoperatorio",
  urpa: "URPA",
  completada: "Completada",
  cancelada: "Cancelada",
};

const ESTADO_BADGE: Record<string, BadgeProps["variant"]> = {
  programada: "outline",
  intra: "destructive",
  urpa: "amber",
  completada: "green",
  cancelada: "gray",
};

const ASA_OPCIONES = ["I", "II", "III", "IV", "V", "VI"];

const ERROR_MSG: Record<string, string> = {
  procedimiento_invalido: "El procedimiento debe tener al menos 3 caracteres.",
  fecha_invalida: "La fecha/hora no es válida.",
  fecha_pasada: "La programación no puede estar en el pasado.",
  paciente_no_encontrado: "El paciente ya no existe en este equipo.",
  sala_no_encontrada: "La sala ya no existe en este equipo.",
  sala_no_disponible: "La sala está ocupada en ese horario (±30 min).",
  cirujano_invalido: "El cirujano seleccionado no es un odontólogo activo del equipo.",
  anestesiologo_invalido: "El anestesiólogo seleccionado no es un odontólogo activo del equipo.",
  asa_invalido: "La clase ASA no es válida.",
  checklist_incompleto: "Completa el checklist preoperatorio antes de iniciar.",
  checklist_invalido: "El checklist no tiene el formato esperado.",
  motivo_requerido: "Indica un motivo de cancelación (mínimo 3 caracteres).",
  notas_urpa_requeridas: "Las notas URPA deben tener al menos 10 caracteres.",
  transicion_invalida: "La cirugía no puede pasar a ese estado.",
  nombre_invalido: "El nombre de la sala debe tener al menos 2 caracteres.",
  sala_repetida: "Ya existe una sala con ese nombre.",
  sala_en_uso: "No puedes desactivar: tiene cirugías programadas para hoy.",
  estado_invalido: "El estado no es válido.",
  hora_invalida: "La hora no es válida.",
  faltan_datos: "Faltan datos obligatorios.",
  sin_sesion: "Tu sesión expiró. Vuelve a iniciar sesión.",
  sin_permiso: "No tienes permiso para esta acción.",
};

function errorDe(error?: string): string {
  return ERROR_MSG[error ?? ""] ?? error ?? "error";
}

export function QuirofanoPanel({
  hoy,
  total,
  completadas,
  salas,
  cirugias,
  doctores,
}: {
  hoy: string;
  total: number;
  completadas: number;
  salas: SalaFila[];
  cirugias: CirugiaFila[];
  doctores: DoctorOpcion[];
}) {
  const router = useRouter();
  const [dialogNueva, setDialogNueva] = useState(false);
  const [dialogSala, setDialogSala] = useState(false);
  const [dialogChecklist, setDialogChecklist] = useState<CirugiaFila | null>(null);
  const [dialogFin, setDialogFin] = useState<CirugiaFila | null>(null);
  const [dialogCancelar, setDialogCancelar] = useState<CirugiaFila | null>(null);
  const [accionando, setAccionando] = useState(false);

  const salasActivas = salas.filter((s) => s.activo);

  const grupos = useMemo(() => {
    const mapa = new Map<string, CirugiaFila[]>();
    for (const s of salasActivas) mapa.set(s.id, []);
    const sinSala: CirugiaFila[] = [];
    for (const c of cirugias) {
      if (c.roomId && mapa.has(c.roomId)) mapa.get(c.roomId)!.push(c);
      else sinSala.push(c);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => a.hora.localeCompare(b.hora));
    }
    sinSala.sort((a, b) => a.hora.localeCompare(b.hora));
    return { mapa, sinSala };
  }, [salasActivas, cirugias]);

  async function patch(body: unknown): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`/api/quirofano/${(body as { id: string }).id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: res.ok, error: j.error };
  }

  async function iniciar(c: CirugiaFila) {
    setAccionando(true);
    try {
      const r = await patch({ id: c.id, estado: "intra" });
      if (!r.ok) {
        toast.error(`No se pudo iniciar: ${errorDe(r.error)}`);
        return;
      }
      toast.success("Cirugía iniciada.");
      router.refresh();
    } finally {
      setAccionando(false);
    }
  }

  async function completar(c: CirugiaFila, notas: string, setNotas: (v: string) => void) {
    setAccionando(true);
    try {
      const r = await patch({ id: c.id, estado: "completada", urpaNotas: notas.trim() });
      if (!r.ok) {
        toast.error(`No se pudo completar: ${errorDe(r.error)}`);
        return;
      }
      setNotas("");
      toast.success("Cirugía completada.");
      router.refresh();
    } finally {
      setAccionando(false);
    }
  }

  async function toggleSala(sala: SalaFila) {
    const res = await fetch(`/api/quirofano/salas/${sala.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !sala.activo }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast.error(`No se pudo actualizar la sala: ${errorDe(j.error)}`);
      return;
    }
    toast.success(sala.activo ? `Sala ${sala.nombre} desactivada.` : `Sala ${sala.nombre} activada.`);
    router.refresh();
  }

  function tarjeta(c: CirugiaFila) {
    const esUrpa = c.estado === "urpa";
    return (
      <div key={c.id} className="rounded-lg border bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{c.nombrePaciente}</p>
            <p className="truncate text-xs text-muted-foreground">{c.procedimiento}</p>
          </div>
          <Badge variant={ESTADO_BADGE[c.estado]}>{ESTADO_LABEL[c.estado]}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium tabular-nums text-foreground">{c.hora}</span>
          {c.cirujanoNombre ? <span>· {c.cirujanoNombre}</span> : null}
          {c.asaClase ? (
            <Badge variant="secondary" className="px-2 py-0">
              ASA {c.asaClase}
            </Badge>
          ) : null}
        </div>
        {c.estado === "cancelada" && c.canceladaMotivo ? (
          <p className="mt-2 text-xs italic text-muted-foreground">Motivo: {c.canceladaMotivo}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {c.estado === "programada" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setDialogChecklist(c)}>
                <ListChecks className="size-4" />
                Checklist preop
              </Button>
              <Button size="sm" disabled={accionando} onClick={() => iniciar(c)}>
                Iniciar cirugía
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDialogCancelar(c)}>
                Cancelar
              </Button>
            </>
          ) : null}
          {c.estado === "intra" ? (
            <>
              <Button size="sm" onClick={() => setDialogFin(c)}>
                Finalizar cirugía
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDialogCancelar(c)}>
                Cancelar
              </Button>
            </>
          ) : null}
          {esUrpa ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setDialogCancelar(c)}>
                Cancelar
              </Button>
            </>
          ) : null}
        </div>
        {esUrpa ? <UrpaNotas cirugia={c} onCompletar={completar} accionando={accionando} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <span className="text-xs text-muted-foreground">Cirugías de hoy</span>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-2xl font-semibold tabular-nums tracking-tight">{total}</span>
            <span className="text-xs text-muted-foreground">programadas para hoy</span>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <span className="text-xs text-muted-foreground">Completadas (con URPA)</span>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-2xl font-semibold tabular-nums tracking-tight">{completadas}</span>
            <Badge variant="green">Completada</Badge>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Salas</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setDialogSala(true)}>
            <DoorOpen className="size-4" />
            Nueva sala
          </Button>
          <Button size="sm" onClick={() => setDialogNueva(true)}>
            <PlusCircle className="size-4" />
            Nueva cirugía
          </Button>
        </div>
      </div>

      {salasActivas.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState
            icon={Scissors}
            title="Sin salas activas"
            description="Crea una sala de operaciones para programar cirugías."
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {salasActivas.map((sala) => {
            const lista = grupos.mapa.get(sala.id) ?? [];
            return (
              <div key={sala.id} className="rounded-2xl border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="size-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">{sala.nombre}</h4>
                    <span className="text-xs text-muted-foreground">
                      {lista.length > 0 ? `${lista.length} cirugía(s)` : "Sin cirugías"}
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => toggleSala(sala)}>
                    Desactivar
                  </Button>
                </div>
                <div className="space-y-3 p-4">
                  {lista.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Libre por hoy.</p>
                  ) : (
                    lista.map(tarjeta)
                  )}
                </div>
              </div>
            );
          })}
          {grupos.sinSala.length > 0 ? (
            <div className="rounded-2xl border border-dashed bg-card lg:col-span-2">
              <div className="border-b px-4 py-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Sin sala asignada</h4>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2">{grupos.sinSala.map(tarjeta)}</div>
            </div>
          ) : null}
        </div>
      )}

      {salas.some((s) => !s.activo) ? (
        <div className="rounded-2xl border bg-card">
          <div className="border-b px-4 py-3">
            <h4 className="text-sm font-semibold text-muted-foreground">Salas desactivadas</h4>
          </div>
          <div className="flex flex-wrap gap-2 p-4">
            {salas
              .filter((s) => !s.activo)
              .map((s) => (
                <Button key={s.id} size="sm" variant="outline" onClick={() => toggleSala(s)}>
                  Activar {s.nombre}
                </Button>
              ))}
          </div>
        </div>
      ) : null}

      <DialogNuevaCirugia
        open={dialogNueva}
        hoy={hoy}
        doctores={doctores}
        onClose={() => setDialogNueva(false)}
      />
      <DialogNuevaSala open={dialogSala} onClose={() => setDialogSala(false)} />
      <DialogChecklist
        cirugia={dialogChecklist}
        onClose={() => setDialogChecklist(null)}
      />
      <DialogFinalizar
        cirugia={dialogFin}
        accionando={accionando}
        onClose={() => setDialogFin(null)}
        onGuardar={async (c, complicaciones) => {
          setAccionando(true);
          try {
            const r = await patch({ id: c.id, estado: "urpa", complicaciones });
            if (!r.ok) {
              toast.error(`No se pudo finalizar: ${errorDe(r.error)}`);
              return;
            }
            toast.success("Cirugía finalizada; pase a URPA.");
            setDialogFin(null);
            router.refresh();
          } finally {
            setAccionando(false);
          }
        }}
      />
      <DialogCancelar
        cirugia={dialogCancelar}
        onClose={() => setDialogCancelar(null)}
        onGuardar={async (c, motivo) => {
          setAccionando(true);
          try {
            const r = await patch({ id: c.id, estado: "cancelada", canceladaMotivo: motivo });
            if (!r.ok) {
              toast.error(`No se pudo cancelar: ${errorDe(r.error)}`);
              return;
            }
            toast.success("Cirugía cancelada.");
            setDialogCancelar(null);
            router.refresh();
          } finally {
            setAccionando(false);
          }
        }}
      />
    </div>
  );
}

function UrpaNotas({
  cirugia,
  onCompletar,
  accionando,
}: {
  cirugia: CirugiaFila;
  onCompletar: (c: CirugiaFila, notas: string, setNotas: (v: string) => void) => void;
  accionando: boolean;
}) {
  const [notas, setNotas] = useState("");
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <Label className="text-xs">Notas URPA (mínimo 10 caracteres)</Label>
      <Textarea
        rows={2}
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        placeholder="Evolución en sala de recuperación…"
      />
      <Button
        size="sm"
        disabled={accionando}
        onClick={() => onCompletar(cirugia, notas, setNotas)}
      >
        Completar
      </Button>
    </div>
  );
}

function DialogNuevaCirugia({
  open,
  hoy,
  doctores,
  onClose,
}: {
  open: boolean;
  hoy: string;
  doctores: DoctorOpcion[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [opciones, setOpciones] = useState<PacienteOpcion[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [procedimiento, setProcedimiento] = useState("");
  const [fechaHora, setFechaHora] = useState(`${hoy}T08:00`);
  const [roomId, setRoomId] = useState("");
  const [salasLibres, setSalasLibres] = useState<SalaFila[]>([]);
  const [cirujanoId, setCirujanoId] = useState("");
  const [anestesiaId, setAnestesiaId] = useState("");
  const [asaClase, setAsaClase] = useState("");
  const [guardando, setGuardando] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dispRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) void cargarDisponibles(fechaHora);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function buscar(texto: string) {
    setQ(texto);
    setPatientId(null);
    const match = opciones.find((o) => o.nombre === texto.trim());
    if (match) setPatientId(match.id);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (texto.trim().length < 1) {
      setOpciones([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/pacientes?q=${encodeURIComponent(texto.trim())}`);
        const j = (await r.json().catch(() => ({}))) as { pacientes?: PacienteOpcion[] };
        const filas = r.ok ? j.pacientes ?? [] : [];
        setOpciones(filas);
        const exacto = filas.find((o) => o.nombre === texto.trim());
        if (exacto) setPatientId(exacto.id);
      } catch {
        setOpciones([]);
      }
    }, 250);
  }

  async function cargarDisponibles(valor: string) {
    const fecha = valor.slice(0, 10);
    const horaIni = valor.slice(11, 16);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(horaIni)) {
      setSalasLibres([]);
      return;
    }
    setRoomId("");
    try {
      const r = await fetch(
        `/api/quirofano/disponibles?fecha=${fecha}&horaIni=${horaIni}`,
      );
      const j = (await r.json().catch(() => ({}))) as { salas?: SalaFila[] };
      setSalasLibres(r.ok ? j.salas ?? [] : []);
    } catch {
      setSalasLibres([]);
    }
  }

  function alCambiarFechaHora(valor: string) {
    setFechaHora(valor);
    if (dispRef.current) clearTimeout(dispRef.current);
    dispRef.current = setTimeout(() => void cargarDisponibles(valor), 300);
  }

  function reset() {
    setQ("");
    setOpciones([]);
    setPatientId(null);
    setProcedimiento("");
    setFechaHora(`${hoy}T08:00`);
    setRoomId("");
    setSalasLibres([]);
    setCirujanoId("");
    setAnestesiaId("");
    setAsaClase("");
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!patientId) {
      toast.error("Busca y selecciona un paciente de la lista.");
      return;
    }
    setGuardando(true);
    try {
      const r = await fetch("/api/quirofano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          procedimiento: procedimiento.trim(),
          scheduledAt: `${fechaHora}:00`,
          roomId: roomId || null,
          cirujanoMembershipId: cirujanoId || null,
          anestesiologoMembershipId: anestesiaId || null,
          asaClase: asaClase || null,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!r.ok) {
        toast.error(`No se pudo programar: ${errorDe(j.error)}`);
        return;
      }
      toast.success("Cirugía programada.");
      reset();
      router.refresh();
    } catch {
      toast.error("No se pudo programar la cirugía.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={reset}
      title="Nueva cirugía"
      icon={<Scissors className="size-4 text-primary" />}
      description="Programa el procedimiento y asigna una sala libre en el horario elegido."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="qui-paciente">Paciente</Label>
          <Input
            id="qui-paciente"
            value={q}
            onChange={(e) => buscar(e.target.value)}
            placeholder="Busca por nombre, celular o documento…"
            autoComplete="off"
            list="qui-pacientes"
          />
          <datalist id="qui-pacientes">
            {opciones.map((o) => (
              <option key={o.id} value={o.nombre}>
                {o.celular}
              </option>
            ))}
          </datalist>
          {patientId ? null : (
            <p className="text-xs text-muted-foreground">
              Escribe y selecciona un resultado de la lista.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="qui-procedimiento">Procedimiento</Label>
          <Input
            id="qui-procedimiento"
            value={procedimiento}
            onChange={(e) => setProcedimiento(e.target.value)}
            placeholder="Ej. Exodoncia de terceros molares"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="qui-fecha">Fecha y hora</Label>
            <Input
              id="qui-fecha"
              type="datetime-local"
              value={fechaHora}
              onChange={(e) => alCambiarFechaHora(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qui-sala">Sala (libres en ese horario)</Label>
            <Select id="qui-sala" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Sin sala</option>
              {salasLibres.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="qui-cirujano">Cirujano (opcional)</Label>
            <Select
              id="qui-cirujano"
              value={cirujanoId}
              onChange={(e) => setCirujanoId(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {doctores.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qui-anestesia">Anestesiólogo (opcional)</Label>
            <Select
              id="qui-anestesia"
              value={anestesiaId}
              onChange={(e) => setAnestesiaId(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {doctores.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qui-asa">Clase ASA</Label>
            <Select id="qui-asa" value={asaClase} onChange={(e) => setAsaClase(e.target.value)}>
              <option value="">—</option>
              {ASA_OPCIONES.map((a) => (
                <option key={a} value={a}>
                  ASA {a}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={reset}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? "Programando…" : "Programar cirugía"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DialogNuevaSala({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      const r = await fetch("/api/quirofano/salas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        toast.error(`No se pudo crear la sala: ${errorDe(j.error)}`);
        return;
      }
      toast.success("Sala creada.");
      setNombre("");
      onClose();
      router.refresh();
    } catch {
      toast.error("No se pudo crear la sala.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nueva sala"
      icon={<DoorOpen className="size-4 text-primary" />}
      description="Registra una sala de operaciones para el equipo."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="qui-sala-nombre">Nombre</Label>
          <Input
            id="qui-sala-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Sala 1"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? "Creando…" : "Crear sala"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DialogChecklist({
  cirugia,
  onClose,
}: {
  cirugia: CirugiaFila | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [checks, setChecks] = useState<boolean[]>(CHECKLIST_LABELS.map(() => false));
  const [guardando, setGuardando] = useState(false);
  const abiertoId = cirugia?.id ?? null;
  const prevId = useRef<string | null>(null);
  if (abiertoId !== prevId.current) {
    prevId.current = abiertoId;
    setChecks(cirugia?.checklistPreop ?? CHECKLIST_LABELS.map(() => false));
  }

  async function guardar() {
    if (!cirugia) return;
    setGuardando(true);
    try {
      const r = await fetch(`/api/quirofano/${cirugia.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklistPreop: checks }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        toast.error(`No se pudo guardar el checklist: ${errorDe(j.error)}`);
        return;
      }
      toast.success("Checklist preoperatorio guardado.");
      onClose();
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  if (!cirugia) return null;

  return (
    <Dialog
      open={Boolean(cirugia)}
      onClose={onClose}
      title="Checklist preoperatorio"
      icon={<ListChecks className="size-4 text-primary" />}
      description={`${cirugia.nombrePaciente} · ${cirugia.procedimiento}`}
    >
      <div className="space-y-3">
        {CHECKLIST_LABELS.map((label, i) => (
          <label key={label} className="flex items-center gap-3 text-sm">
            <Checkbox
              checked={checks[i]}
              onChange={() =>
                setChecks((prev) => prev.map((v, idx) => (idx === i ? !v : v)))
              }
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cerrar
        </Button>
        <Button type="button" disabled={guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </Dialog>
  );
}

function DialogFinalizar({
  cirugia,
  accionando,
  onClose,
  onGuardar,
}: {
  cirugia: CirugiaFila | null;
  accionando: boolean;
  onClose: () => void;
  onGuardar: (c: CirugiaFila, complicaciones: string) => void;
}) {
  const [complicaciones, setComplicaciones] = useState("");
  const abiertoId = cirugia?.id ?? null;
  const prevId = useRef<string | null>(null);
  if (abiertoId !== prevId.current) {
    prevId.current = abiertoId;
    setComplicaciones("");
  }

  if (!cirugia) return null;

  return (
    <Dialog
      open={Boolean(cirugia)}
      onClose={onClose}
      title="Finalizar cirugía"
      description={`Registra el fin del acto operatorio de ${cirugia.nombrePaciente} y el pase a URPA.`}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="qui-complicaciones">Complicaciones (opcional)</Label>
          <Textarea
            id="qui-complicaciones"
            rows={3}
            value={complicaciones}
            onChange={(e) => setComplicaciones(e.target.value)}
            placeholder="Describe complicaciones si las hubo…"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            type="button"
            disabled={accionando}
            onClick={() => onGuardar(cirugia, complicaciones.trim())}
          >
            {accionando ? "Finalizando…" : "Finalizar cirugía"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function DialogCancelar({
  cirugia,
  onClose,
  onGuardar,
}: {
  cirugia: CirugiaFila | null;
  onClose: () => void;
  onGuardar: (c: CirugiaFila, motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const abiertoId = cirugia?.id ?? null;
  const prevId = useRef<string | null>(null);
  if (abiertoId !== prevId.current) {
    prevId.current = abiertoId;
    setMotivo("");
  }

  if (!cirugia) return null;

  return (
    <Dialog
      open={Boolean(cirugia)}
      onClose={onClose}
      title="Cancelar cirugía"
      description={`${cirugia.nombrePaciente} · ${cirugia.procedimiento}`}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="qui-motivo">Motivo de cancelación</Label>
          <Textarea
            id="qui-motivo"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo por el que se cancela la cirugía…"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Volver
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={guardando}
            onClick={async () => {
              setGuardando(true);
              try {
                await onGuardar(cirugia, motivo.trim());
              } finally {
                setGuardando(false);
              }
            }}
          >
            {guardando ? "Cancelando…" : "Cancelar cirugía"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
