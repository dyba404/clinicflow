"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BedDouble, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/console/empty-state";

export interface AdmisionActiva {
  id: string;
  nombrePaciente: string;
  tipo: string;
  motivo: string;
  admitidaEl: string;
  cama: string | null;
}

export interface CamaFila {
  id: string;
  nombre: string;
  area: string | null;
  tipo: string;
  estado: string;
  ocupante: string | null;
  admissionId: string | null;
}

interface PacienteOpcion {
  id: string;
  nombre: string;
  celular: string;
}

export const TIPO_LABEL: Record<string, string> = {
  emergencia: "Emergencia",
  observacion: "Observación",
  internamiento: "Internamiento",
};

export const TIPO_BADGE: Record<string, "red" | "amber" | "blue"> = {
  emergencia: "red",
  observacion: "amber",
  internamiento: "blue",
};

const ESTADO_LABEL: Record<string, string> = {
  libre: "Libre",
  ocupada: "Ocupada",
  limpieza: "Limpieza",
  bloqueada: "Bloqueada",
};

const ESTADO_BADGE: Record<string, "green" | "red" | "amber" | "gray"> = {
  libre: "green",
  ocupada: "red",
  limpieza: "amber",
  bloqueada: "gray",
};

const CAMA_TIPO_LABEL: Record<string, string> = {
  cama: "Cama",
  sillon: "Sillón",
  aislamiento: "Aislamiento",
};

const ERROR_MSG: Record<string, string> = {
  paciente_no_encontrado: "El paciente ya no existe en este equipo.",
  tipo_invalido: "El tipo de internamiento no es válido.",
  motivo_invalido: "El motivo debe tener al menos 3 caracteres.",
  admision_ya_activa: "El paciente ya tiene una admisión activa.",
  cama_no_encontrada: "La cama ya no existe en este equipo.",
  cama_no_disponible: "La cama ya no está disponible.",
  sin_sesion: "Tu sesión expiró. Vuelve a iniciar sesión.",
  sin_permiso: "No tienes permiso para esta acción.",
};

export function HospitalizacionPanel({
  activas,
  camas,
}: {
  activas: AdmisionActiva[];
  camas: CamaFila[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialogNuevo, setDialogNuevo] = useState(false);

  const conteo = {
    libre: camas.filter((c) => c.estado === "libre").length,
    ocupada: camas.filter((c) => c.estado === "ocupada").length,
    limpieza: camas.filter((c) => c.estado === "limpieza").length,
    bloqueada: camas.filter((c) => c.estado === "bloqueada").length,
  };

  function cambiarEstadoCama(cama: CamaFila, estado: string) {
    if (estado === cama.estado) return;
    start(async () => {
      const res = await fetch(`/api/hospitalizacion/camas/${cama.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(`No se pudo actualizar la cama: ${ERROR_MSG[j.error ?? ""] ?? j.error ?? "error"}`);
        return;
      }
      const accion =
        estado === "libre" && cama.estado === "limpieza"
          ? "marcada como limpia"
          : estado === "bloqueada"
            ? "bloqueada"
            : estado === "libre"
              ? "liberada"
              : "actualizada";
      toast.success(`Cama ${cama.nombre} ${accion}.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <span className="text-xs text-muted-foreground">Admisiones activas</span>
          <div className="mt-3">
            <span className="text-2xl font-semibold tabular-nums tracking-tight">
              {activas.length}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">pacientes internados</span>
          </div>
          {activas.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {activas.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <a
                      href={`/consola/hospitalizacion/${a.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {a.nombrePaciente}
                    </a>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.admitidaEl}
                      {a.cama ? ` · Cama ${a.cama}` : " · Sin cama"}
                    </p>
                  </div>
                  <Badge variant={TIPO_BADGE[a.tipo] ?? "gray"}>
                    {TIPO_LABEL[a.tipo] ?? a.tipo}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">No hay admisiones activas.</p>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <span className="text-xs text-muted-foreground">Ocupación</span>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {(
              [
                ["libre", "Libres"],
                ["ocupada", "Ocupadas"],
                ["limpieza", "En limpieza"],
                ["bloqueada", "Bloqueadas"],
              ] as const
            ).map(([estado, etiqueta]) => (
              <div key={estado} className="rounded-lg border px-3 py-2">
                <span className="text-xs text-muted-foreground">{etiqueta}</span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xl font-semibold tabular-nums">
                    {conteo[estado]}
                  </span>
                  <Badge variant={ESTADO_BADGE[estado]}>{ESTADO_LABEL[estado]}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between gap-2 border-b p-4">
          <h3 className="text-sm font-semibold">Camas</h3>
          <Button size="sm" onClick={() => setDialogNuevo(true)}>
            <PlusCircle className="size-4" />
            Nuevo ingreso
          </Button>
        </div>
        {camas.length === 0 ? (
          <EmptyState
            icon={BedDouble}
            title="Sin camas registradas"
            description="Crea tu primera cama para empezar a asignar admisiones."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cama</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Ocupante</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {camas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm font-medium">{c.nombre}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.area ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {CAMA_TIPO_LABEL[c.tipo] ?? c.tipo}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ESTADO_BADGE[c.estado] ?? "gray"}>
                      {ESTADO_LABEL[c.estado] ?? c.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.ocupante ? (
                      <a
                        href={`/consola/hospitalizacion/${c.admissionId}`}
                        className="font-medium hover:underline"
                      >
                        {c.ocupante}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Select
                      value={c.estado}
                      disabled={pending}
                      onChange={(e) => cambiarEstadoCama(c, e.target.value)}
                      className="ml-auto w-36"
                    >
                      <option value="libre">Libre</option>
                      <option value="ocupada" disabled>
                        Ocupada
                      </option>
                      <option value="limpieza">Limpieza</option>
                      <option value="bloqueada">Bloqueada</option>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <DialogNuevoIngreso
        open={dialogNuevo}
        camas={camas.filter((c) => c.estado === "libre")}
        onClose={() => setDialogNuevo(false)}
      />
    </div>
  );
}

function DialogNuevoIngreso({
  open,
  camas,
  onClose,
}: {
  open: boolean;
  camas: CamaFila[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [opciones, setOpciones] = useState<PacienteOpcion[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [tipo, setTipo] = useState("internamiento");
  const [motivo, setMotivo] = useState("");
  const [camaId, setCamaId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function reset() {
    setQ("");
    setOpciones([]);
    setPatientId(null);
    setTipo("internamiento");
    setMotivo("");
    setCamaId("");
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
      const r = await fetch("/api/hospitalizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          tipo,
          motivo: motivo.trim(),
          cama: camaId || null,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!r.ok) {
        toast.error(ERROR_MSG[j.error ?? ""] ?? `No se pudo registrar el ingreso: ${j.error ?? "error"}`);
        return;
      }
      toast.success("Ingreso registrado.");
      reset();
      router.refresh();
      if (j.id) router.push(`/consola/hospitalizacion/${j.id}`);
    } catch {
      toast.error("No se pudo registrar el ingreso.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={reset}
      title="Nuevo ingreso"
      icon={<BedDouble className="size-4 text-primary" />}
      description="Registra la admisión del paciente y, si hay disponibilidad, asígnale una cama."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="hon-paciente">Paciente</Label>
          <Input
            id="hon-paciente"
            value={q}
            onChange={(e) => buscar(e.target.value)}
            placeholder="Busca por nombre, celular o documento…"
            autoComplete="off"
            list="hon-pacientes"
          />
          <datalist id="hon-pacientes">
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hon-tipo">Tipo</Label>
            <Select id="hon-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="internamiento">Internamiento</option>
              <option value="emergencia">Emergencia</option>
              <option value="observacion">Observación</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hon-cama">Cama (opcional, solo libres)</Label>
            <Select id="hon-cama" value={camaId} onChange={(e) => setCamaId(e.target.value)}>
              <option value="">Sin cama</option>
              {camas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.area ? ` · ${c.area}` : ""}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hon-motivo">Motivo</Label>
          <Textarea
            id="hon-motivo"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo del ingreso…"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={reset}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? "Registrando…" : "Registrar ingreso"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
