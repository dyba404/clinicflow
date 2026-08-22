"use client";

import { useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HeartPulse, PlusCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface FilaBalance {
  hora: string;
  descripcion: string;
  volumen_ml_num: number;
}

export interface BalanceHidrico {
  ingresos: FilaBalance[];
  egresos: FilaBalance[];
  balance_total: number;
}

export interface EstanciaUci {
  id: string;
  patientId: string;
  nombrePaciente: string;
  admissionId: string | null;
  ingresoAt: string;
  egresoAt: string | null;
  balance: BalanceHidrico | null;
  notas: string | null;
  cobertura: string | null;
}

interface PacienteOpcion {
  id: string;
  nombre: string;
  celular: string;
}

const ERROR_MSG: Record<string, string> = {
  paciente_no_encontrado: "El paciente ya no existe en este equipo.",
  admision_no_encontrada: "La admisión no existe o ya no está activa.",
  uci_ya_activa: "El paciente ya tiene una estancia UCI activa.",
  balance_requerido_para_egreso: "Guarda el balance hídrico antes de egresar.",
  balance_invalido: "El balance hídrico no es válido.",
  estancia_no_encontrada: "La estancia ya no existe.",
  estancia_ya_egresada: "El paciente ya egresó de UCI.",
  sin_sesion: "Tu sesión expiró. Vuelve a iniciar sesión.",
  sin_permiso: "No tienes permiso para esta acción.",
};

function errorDe(j: { error?: string } | null): string {
  const clave = j?.error ?? "";
  return ERROR_MSG[clave] ?? clave ?? "error";
}

function tiempoUci(ingresoAt: string): string {
  const diffMs = Date.now() - new Date(ingresoAt).getTime();
  const dias = Math.floor(diffMs / 86_400_000);
  const horas = Math.floor((diffMs % 86_400_000) / 3_600_000);
  if (dias > 0) return `${dias}d ${horas}h en UCI`;
  if (horas > 0) return `${horas}h en UCI`;
  const minutos = Math.max(1, Math.floor((diffMs % 3_600_000) / 60_000));
  return `${minutos}min en UCI`;
}

function filaVacia(): FilaBalance {
  return { hora: "", descripcion: "", volumen_ml_num: 0 };
}

export function UciPanel({ estancias }: { estancias: EstanciaUci[] }) {
  const router = useRouter();
  const [dialogBalance, setDialogBalance] = useState<EstanciaUci | null>(null);
  const [dialogNuevo, setDialogNuevo] = useState(false);

  async function guardarBalance(estancia: EstanciaUci, balance: BalanceHidrico, cerrar: () => void) {
    const res = await fetch(`/api/uci/${estancia.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balanceHidrico: balance }),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !j?.ok) {
      toast.error(`No se pudo guardar el balance: ${errorDe(j)}`);
      return;
    }
    toast.success("Balance hídrico guardado.");
    cerrar();
    router.refresh();
  }

  async function egresar(estancia: EstanciaUci) {
    if (!estancia.balance) {
      toast.error("Registra y guarda el balance hídrico antes de egresar.");
      return;
    }
    const res = await fetch(`/api/uci/${estancia.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ egreso: true }),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !j?.ok) {
      toast.error(`No se pudo egresar: ${errorDe(j)}`);
      return;
    }
    toast.success(`${estancia.nombrePaciente} egresado de UCI.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogNuevo(true)}>
          <PlusCircle className="size-4" />
          Nuevo ingreso UCI
        </Button>
      </div>

      {estancias.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {estancias.map((e) => (
            <div key={e.id} className="rounded-2xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.nombrePaciente}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tiempoUci(e.ingresoAt)}
                  </p>
                </div>
                <HeartPulse className="size-5 shrink-0 text-primary" />
              </div>

              {e.cobertura ? (
                <Badge variant="violet" className="mt-3">
                  {e.cobertura}
                </Badge>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">Sin adhesión</p>
              )}

              {e.balance ? (
                <p className="mt-3 text-xs text-muted-foreground tabular-nums">
                  Balance:{" "}
                  <span className={e.balance.balance_total >= 0 ? "text-emerald-700" : "text-red-700"}>
                    {e.balance.balance_total >= 0 ? "+" : ""}
                    {e.balance.balance_total} ml
                  </span>{" "}
                  · Ingresos {e.balance.ingresos.length} · Egresos {e.balance.egresos.length}
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">Sin balance registrado</p>
              )}

              {e.notas ? (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{e.notas}</p>
              ) : null}

              <div className="mt-4 flex justify-end gap-2 border-t border-border-subtle pt-3">
                <Button variant="outline" size="sm" onClick={() => setDialogBalance(e)}>
                  Balance hídrico
                </Button>
                <Button variant="ghost" size="sm" onClick={() => egresar(e)}>
                  Egresar de UCI
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {dialogBalance ? (
        <BalanceDialog
          key={dialogBalance.id}
          estancia={dialogBalance}
          onSave={(balance) => guardarBalance(dialogBalance, balance, () => setDialogBalance(null))}
          onClose={() => setDialogBalance(null)}
        />
      ) : null}

      <DialogNuevoIngreso open={dialogNuevo} onClose={() => setDialogNuevo(false)} />
    </div>
  );
}

function BalanceDialog({
  estancia,
  onSave,
  onClose,
}: {
  estancia: EstanciaUci;
  onSave: (balance: BalanceHidrico) => Promise<void>;
  onClose: () => void;
}) {
  const [ingresos, setIngresos] = useState<FilaBalance[]>(
    estancia.balance?.ingresos.length ? estancia.balance.ingresos : [filaVacia()],
  );
  const [egresos, setEgresos] = useState<FilaBalance[]>(
    estancia.balance?.egresos.length ? estancia.balance.egresos : [filaVacia()],
  );
  const [guardando, setGuardando] = useState(false);

  const total = useMemo(
    () =>
      ingresos.reduce((acc, f) => acc + (Number(f.volumen_ml_num) || 0), 0) -
      egresos.reduce((acc, f) => acc + (Number(f.volumen_ml_num) || 0), 0),
    [ingresos, egresos],
  );

  function setFila(
    setter: Dispatch<SetStateAction<FilaBalance[]>>,
    i: number,
    campo: keyof FilaBalance,
    valor: string,
  ) {
    setter((filas) =>
      filas.map((f, idx) =>
        idx === i
          ? campo === "volumen_ml_num"
            ? { ...f, volumen_ml_num: Number(valor) || 0 }
            : { ...f, [campo]: valor }
          : f,
      ),
    );
  }

  function quitarFila(setter: Dispatch<SetStateAction<FilaBalance[]>>, i: number) {
    setter((filas) => filas.filter((_, idx) => idx !== i));
  }

  function limpiar(filas: FilaBalance[]): FilaBalance[] {
    return filas
      .filter((f) => f.descripcion.trim() !== "" || (Number(f.volumen_ml_num) || 0) > 0)
      .map((f) => ({ hora: f.hora, descripcion: f.descripcion.trim(), volumen_ml_num: Number(f.volumen_ml_num) || 0 }));
  }

  async function guardar() {
    const limpioIng = limpiar(ingresos);
    const limpioEgr = limpiar(egresos);
    setGuardando(true);
    try {
      await onSave({ ingresos: limpioIng, egresos: limpioEgr, balance_total: total });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Balance hídrico · ${estancia.nombrePaciente}`}
      icon={<HeartPulse className="size-4 text-primary" />}
      description="Reemplaza el balance completo: las filas enviadas sustituyen a las guardadas."
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
          <span className="text-sm font-medium">Total (Ingresos − Egresos)</span>
          <span
            className={`text-lg font-semibold tabular-nums ${total >= 0 ? "text-emerald-700" : "text-red-700"}`}
          >
            {total >= 0 ? "+" : ""}
            {total} ml
          </span>
        </div>

        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Ingresos</h4>
          <div className="grid grid-cols-[88px_1fr_96px_32px] items-center gap-2 text-xs text-muted-foreground">
            <span>Hora</span>
            <span>Descripción</span>
            <span>Volumen (ml)</span>
            <span />
          </div>
          {ingresos.map((f, i) => (
            <div key={i} className="grid grid-cols-[88px_1fr_96px_32px] items-center gap-2">
              <Input type="time" value={f.hora} onChange={(e) => setFila(setIngresos, i, "hora", e.target.value)} />
              <Input
                value={f.descripcion}
                onChange={(e) => setFila(setIngresos, i, "descripcion", e.target.value)}
                placeholder="Suero fisiológico…"
              />
              <Input
                type="number"
                min={0}
                step="any"
                value={f.volumen_ml_num}
                onChange={(e) => setFila(setIngresos, i, "volumen_ml_num", e.target.value)}
                className="tabular-nums"
              />
              <button
                type="button"
                aria-label="Quitar fila de ingresos"
                onClick={() => quitarFila(setIngresos, i)}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setIngresos((f) => [...f, filaVacia()])}>
            <PlusCircle className="size-4" />
            + otra
          </Button>
        </section>

        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-red-700">Egresos</h4>
          <div className="grid grid-cols-[88px_1fr_96px_32px] items-center gap-2 text-xs text-muted-foreground">
            <span>Hora</span>
            <span>Descripción</span>
            <span>Volumen (ml)</span>
            <span />
          </div>
          {egresos.map((f, i) => (
            <div key={i} className="grid grid-cols-[88px_1fr_96px_32px] items-center gap-2">
              <Input type="time" value={f.hora} onChange={(e) => setFila(setEgresos, i, "hora", e.target.value)} />
              <Input
                value={f.descripcion}
                onChange={(e) => setFila(setEgresos, i, "descripcion", e.target.value)}
                placeholder="Diuresis, drenaje…"
              />
              <Input
                type="number"
                min={0}
                step="any"
                value={f.volumen_ml_num}
                onChange={(e) => setFila(setEgresos, i, "volumen_ml_num", e.target.value)}
                className="tabular-nums"
              />
              <button
                type="button"
                aria-label="Quitar fila de egresos"
                onClick={() => quitarFila(setEgresos, i)}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setEgresos((f) => [...f, filaVacia()])}>
            <PlusCircle className="size-4" />
            + otra
          </Button>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar balance"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function DialogNuevoIngreso({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [opciones, setOpciones] = useState<PacienteOpcion[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
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
    setNotas("");
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
      const r = await fetch("/api/uci", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, notas: notas.trim() || null }),
      });
      const j = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!r.ok) {
        toast.error(`No se pudo registrar el ingreso: ${errorDe(j)}`);
        return;
      }
      toast.success("Ingreso UCI registrado.");
      reset();
      router.refresh();
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
      title="Nuevo ingreso UCI"
      icon={<HeartPulse className="size-4 text-primary" />}
      description="Registra la entrada del paciente a la unidad de cuidados intensivos."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="uci-paciente">Paciente</Label>
          <Input
            id="uci-paciente"
            value={q}
            onChange={(e) => buscar(e.target.value)}
            placeholder="Busca por nombre, celular o documento…"
            autoComplete="off"
            list="uci-pacientes"
          />
          <datalist id="uci-pacientes">
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
          <Label htmlFor="uci-notas">Nota</Label>
          <Textarea
            id="uci-notas"
            rows={3}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Observaciones del ingreso…"
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
