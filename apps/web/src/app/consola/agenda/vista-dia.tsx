"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtPEN } from "@/lib/format";
import type { citasDelDia, bloqueosDia, doctoresConColor } from "@/lib/console-data";
import { CitaActions } from "./cita-actions";
import { BloqueoChip } from "./bloqueo-chip";

type Cita = Awaited<ReturnType<typeof citasDelDia>>[number];
type Bloqueo = Awaited<ReturnType<typeof bloqueosDia>>[number];
type AgendaDoctor = Awaited<ReturnType<typeof doctoresConColor>>[number];

const HORAS = Array.from({ length: 14 }, (_, i) => i + 7);
const HORAS_MS = HORAS.length * 60;
const INI_MS = (HORAS[0] ?? 7) * 60;
const HORA_PX = 64;

function minutos(hora: string): number {
  const [h = 0, m = 0] = hora.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function aHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function durCita(cita: Cita): number {
  return minutos(cita.horaFin) - minutos(cita.horaIni);
}

function ajustarMinutos(y: number, cita: Cita): number {
  const crudo = INI_MS + Math.round(((y / HORA_PX) * 60) / 15) * 15;
  const dur = Math.min(Math.max(durCita(cita), 15), HORAS_MS);
  const max = INI_MS + HORAS_MS - dur;
  return Math.min(Math.max(INI_MS, crudo), max);
}

interface Fantasma {
  colId: string;
  top: number;
  height: number;
  min: number;
}

interface Posicion {
  top: number;
  height: number;
  left: number;
  ancho: number;
}

interface MasInfo {
  key: string;
  pos: Posicion;
  citas: Cita[];
}

const MAX_LANES = 4;

function layoutCitas(citas: Cita[]): { pos: Map<string, Posicion>; mas: MasInfo[] } {
  const pos = new Map<string, Posicion>();
  const activos: Array<{ fin: number; cluster: number }> = [];
  const lanes: Array<{ fin: number }> = [];
  const overflow = new Map<number, { min: number; max: number; citas: Cita[] }>();
  let cluster = 0;
  const orden = [...citas].sort(
    (a, b) => minutos(a.horaIni) - minutos(b.horaIni) || minutos(b.horaFin) - minutos(a.horaFin),
  );
  for (const c of orden) {
    const ini = minutos(c.horaIni);
    const fin = minutos(c.horaFin);
    while (activos.length > 0 && (activos[0]?.fin ?? Infinity) <= ini) activos.shift();
    if (activos.length === 0) cluster++;
    const ocupados = new Set(
      lanes.filter((l) => l.fin > ini).map((l) => lanes.indexOf(l)),
    );
    let lane = 0;
    while (ocupados.has(lane)) lane++;
    const n = Math.min(Math.max(activos.length + 1, lane + 1), MAX_LANES + 1);
    if (lane >= MAX_LANES) {
      const o = overflow.get(cluster) ?? { min: ini, max: fin, citas: [] };
      o.min = Math.min(o.min, ini);
      o.max = Math.max(o.max, fin);
      o.citas.push(c);
      overflow.set(cluster, o);
    } else {
      const ancho = 100 / n;
      pos.set(c.id, {
        top: ((ini - INI_MS) / 60) * HORA_PX,
        height: Math.max(((fin - ini) / 60) * HORA_PX, 28),
        left: lane * ancho,
        ancho,
      });
    }
    activos.push({ fin, cluster });
    lanes[lane] = { fin };
  }
  const mas = [...overflow.entries()].map(([c, o]) => ({
    key: `mas-${c}`,
    pos: {
      top: ((o.min - INI_MS) / 60) * HORA_PX,
      height: Math.max(((o.max - o.min) / 60) * HORA_PX, 28),
      left: (MAX_LANES * 100) / (MAX_LANES + 1),
      ancho: 100 / (MAX_LANES + 1),
    },
    citas: o.citas,
  }));
  return { pos, mas };
}

function ChipCita({
  cita,
  pos,
  color,
  sinAsignar,
  fechaISO,
  doctoresTodos,
  arrastrable,
  siendoArrastrada,
  onDragStart,
  onDragEnd,
}: {
  cita: Cita;
  pos: Posicion;
  color?: string;
  sinAsignar?: boolean;
  fechaISO: string;
  doctoresTodos: AgendaDoctor[];
  arrastrable: boolean;
  siendoArrastrada: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const atenuada = cita.estado === "cancelada" || cita.estado === "no_show";
  const accionable = cita.estado === "solicitada" || cita.estado === "confirmada";
  return (
    <div
      draggable={arrastrable}
      onDragStart={arrastrable ? onDragStart : undefined}
      onDragEnd={arrastrable ? onDragEnd : undefined}
      className={cn(
        "absolute z-20 overflow-hidden rounded-md border-l-[3px] px-2 py-1 transition-shadow hover:shadow-md ring-1 ring-black/10",
        sinAsignar ? "border-l-muted-foreground/40 bg-muted/30" : "",
        atenuada && "opacity-45",
        arrastrable && "cursor-grab",
        siendoArrastrada && "cursor-grabbing opacity-50",
      )}
      style={{
        top: pos.top,
        height: pos.height,
        left: `calc(${pos.left}% + 4px)`,
        width: `calc(${pos.ancho}% - 8px)`,
        backgroundColor: sinAsignar || !color ? undefined : `${color}14`,
        borderLeftColor: sinAsignar ? undefined : color,
      }}
    >
      <div className="text-[10px] font-medium tabular-nums text-muted-foreground">
        {cita.horaIni.slice(0, 5)} – {cita.horaFin.slice(0, 5)}
      </div>
      <div className="truncate text-xs font-semibold">{cita.patientNombre}</div>
      {pos.height > 50 ? (
        <div className="truncate text-[10px] text-muted-foreground">{cita.servicio}</div>
      ) : null}
      {pos.height > 40 ? (
        <div className="text-[10px] font-medium tabular-nums">{fmtPEN(Number(cita.servicioPrecio))}</div>
      ) : null}
      {accionable ? (
        <div
          data-no-drag
          className="absolute right-1 top-1 flex items-center rounded-md bg-card/90 opacity-50 shadow-sm transition-opacity hover:opacity-100"
        >
          <CitaActions
            citaId={cita.id}
            paciente={cita.patientNombre}
            doctorId={cita.doctorId}
            fecha={fechaISO}
            horaIni={cita.horaIni}
            doctores={doctoresTodos}
          />
        </div>
      ) : null}
    </div>
  );
}

function MasChip({ m }: { m: MasInfo }) {
  const [popup, setPopup] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!popup) return;
    const onDown = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setPopup(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopup(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [popup]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setPopup((p) => (p ? null : { left: r.left + r.width / 2, top: r.bottom + 4 }));
        }}
        aria-label={`${m.citas.length} citas superpuestas sin mostrar`}
        className="absolute z-30 w-full cursor-pointer rounded-md border border-dashed border-muted-foreground/50 bg-card/85 text-[10px] font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        style={{
          top: m.pos.top,
          height: Math.max(m.pos.height, 24),
          left: `calc(${m.pos.left}% + 4px)`,
          width: `calc(${m.pos.ancho}% - 8px)`,
        }}
      >
        +{m.citas.length} más
      </button>
      {popup ? (
        <div
          className="fixed z-50 w-52 rounded-lg border bg-card p-2.5 shadow-md"
          style={{ left: Math.max(8, popup.left - 104), top: popup.top }}
        >
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Citas superpuestas
          </p>
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {m.citas.map((c) => (
              <li key={c.id} className="border-b border-border-subtle pb-1.5 last:border-b-0 last:pb-0">
                <p className="text-[10px] font-medium tabular-nums text-muted-foreground">
                  {c.horaIni.slice(0, 5)} – {c.horaFin.slice(0, 5)}
                </p>
                <p className="truncate text-xs font-semibold">{c.patientNombre}</p>
                <p className="truncate text-[10px] text-muted-foreground">{c.servicio}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function ColumnaDia({
  citas,
  bloqueos,
  color,
  sinAsignar,
  fechaISO,
  doctoresTodos,
  colId,
  doctorDestino,
  permiteDrag,
  dragId,
  fantasma,
  onDragStartCita,
  onFinDrag,
  onDragOverColumna,
  onDragLeaveColumna,
  onDropColumna,
}: {
  citas: Cita[];
  bloqueos: Bloqueo[];
  color?: string;
  sinAsignar?: boolean;
  fechaISO: string;
  doctoresTodos: AgendaDoctor[];
  colId: string;
  doctorDestino: string | null;
  permiteDrag: boolean;
  dragId: string | null;
  fantasma: Fantasma | null;
  onDragStartCita: (cita: Cita, e: DragEvent<HTMLDivElement>) => void;
  onFinDrag: () => void;
  onDragOverColumna: (colId: string, e: DragEvent<HTMLDivElement>) => void;
  onDragLeaveColumna: (colId: string, e: DragEvent<HTMLDivElement>) => void;
  onDropColumna: (
    colId: string,
    doctorDestino: string | null,
    e: DragEvent<HTMLDivElement>,
  ) => void;
}) {
  const { pos, mas } = layoutCitas(citas);
  return (
    <div
      className="relative flex-1 overflow-hidden"
      onDragOver={(e) => onDragOverColumna(colId, e)}
      onDragLeave={(e) => onDragLeaveColumna(colId, e)}
      onDrop={(e) => onDropColumna(colId, doctorDestino, e)}
    >
      {HORAS.map((h, i) => (
        <div
          key={`${h}-${i}`}
          className={cn("border-t border-dashed", i % 2 === 1 && "bg-muted/10")}
          style={{ height: HORA_PX }}
        />
      ))}
      {bloqueos.map((b) => {
        const ini = minutos(b.horaIni);
        const fin = minutos(b.horaFin);
        if (fin <= INI_MS || ini >= INI_MS + HORAS_MS) return null;
        const top = ((Math.max(ini, INI_MS) - INI_MS) / 60) * HORA_PX;
        const height = Math.max(
          ((Math.min(fin, INI_MS + HORAS_MS) - Math.max(ini, INI_MS)) / 60) * HORA_PX,
          20,
        );
        return (
          <BloqueoChip
            key={b.id}
            id={b.id}
            motivo={b.motivo}
            className="absolute inset-x-1 z-10 flex items-center rounded bg-muted/60 px-2 text-xs text-muted-foreground"
            style={{ top, height }}
          />
        );
      })}
      {citas.map((c) => {
        const p = pos.get(c.id);
        if (!p) return null;
        const arrastrable =
          permiteDrag && (c.estado === "solicitada" || c.estado === "confirmada");
        return (
          <ChipCita
            key={c.id}
            cita={c}
            pos={p}
            color={color}
            sinAsignar={sinAsignar}
            fechaISO={fechaISO}
            doctoresTodos={doctoresTodos}
            arrastrable={arrastrable}
            siendoArrastrada={dragId === c.id}
            onDragStart={(e) => onDragStartCita(c, e)}
            onDragEnd={onFinDrag}
          />
        );
      })}
      {mas.map((m) => (
        <MasChip key={m.key} m={m} />
      ))}
      {fantasma && fantasma.colId === colId ? (
        <div
          className="pointer-events-none absolute inset-x-1 z-30 rounded-md border-2 border-dashed border-primary/70 bg-primary/10 px-1 text-[10px] font-medium tabular-nums text-primary"
          style={{ top: fantasma.top, height: fantasma.height }}
        >
          {aHHMM(fantasma.min)}
        </div>
      ) : null}
    </div>
  );
}

export function VistaDia({
  fechaISO,
  citas,
  bloqueos,
  doctores,
  doctoresTodos,
  esDoctor,
}: {
  fechaISO: string;
  citas: Cita[];
  bloqueos: Bloqueo[];
  doctores: AgendaDoctor[];
  doctoresTodos: AgendaDoctor[];
  esDoctor: boolean;
}) {
  const router = useRouter();
  const [drag, setDrag] = useState<Cita | null>(null);
  const [fantasma, setFantasma] = useState<Fantasma | null>(null);
  const permiteDrag = !esDoctor;

  function iniciarDrag(cita: Cita, e: DragEvent<HTMLDivElement>) {
    if (!permiteDrag) return;
    if ((e.target as HTMLElement).closest("[data-no-drag]")) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", cita.id);
    e.dataTransfer.effectAllowed = "move";
    setDrag(cita);
  }

  function finDrag() {
    setDrag(null);
    setFantasma(null);
  }

  function dragOverColumna(colId: string, e: DragEvent<HTMLDivElement>) {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const min = ajustarMinutos(e.clientY - rect.top, drag);
    const top = ((min - INI_MS) / 60) * HORA_PX;
    const height = Math.max((Math.min(Math.max(durCita(drag), 15), HORAS_MS) / 60) * HORA_PX, 28);
    setFantasma((g) =>
      g && g.colId === colId && g.top === top ? g : { colId, top, height, min },
    );
  }

  function dragLeaveColumna(colId: string, e: DragEvent<HTMLDivElement>) {
    if (!drag) return;
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setFantasma((g) => (g && g.colId === colId ? null : g));
  }

  async function dropColumna(
    colId: string,
    doctorDestino: string | null,
    e: DragEvent<HTMLDivElement>,
  ) {
    e.preventDefault();
    const cita = drag;
    setDrag(null);
    setFantasma(null);
    if (!cita) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const min = ajustarMinutos(e.clientY - rect.top, cita);
    const nuevaHora = aHHMM(min);
    if (nuevaHora === cita.horaIni.slice(0, 5) && doctorDestino === cita.doctorId) return;
    const r = await fetch(`/api/citas/${cita.id}/reprogramar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha: fechaISO, horaIni: nuevaHora, doctorId: doctorDestino }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (j.error === "horario_ocupado") {
        toast.error("El horario elegido está ocupado");
      } else {
        toast.error(j.error ?? "No se pudo reprogramar");
      }
      return;
    }
    const j = (await r.json().catch(() => ({}))) as { reactivada?: boolean };
    toast.success(
      `Cita de ${cita.patientNombre} reprogramada${j.reactivada ? " (reactivada como solicitada)" : ""}`,
    );
    router.refresh();
  }

  const sinAsignar = esDoctor ? [] : citas.filter((c) => !c.doctorId);
  const grupos = doctores.map((d) => ({
    doctor: d,
    lista: citas.filter((c) => c.doctorId === d.id),
  }));
  const columnas = [
    ...grupos.map((g, i) => ({
      id: g.doctor.id,
      border: i > 0,
      header: (
        <>
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: g.doctor.color }} />
          <span className="truncate text-sm font-medium">{g.doctor.name}</span>
        </>
      ),
      body: (
        <ColumnaDia
          citas={g.lista}
          bloqueos={bloqueos.filter((b) => b.doctorId === g.doctor.id || b.doctorId === null)}
          color={g.doctor.color}
          fechaISO={fechaISO}
          doctoresTodos={doctoresTodos}
          colId={g.doctor.id}
          doctorDestino={g.doctor.id}
          permiteDrag={permiteDrag}
          dragId={drag?.id ?? null}
          fantasma={fantasma}
          onDragStartCita={iniciarDrag}
          onFinDrag={finDrag}
          onDragOverColumna={dragOverColumna}
          onDragLeaveColumna={dragLeaveColumna}
          onDropColumna={dropColumna}
        />
      ),
    })),
    ...(sinAsignar.length > 0
      ? [
          {
            id: "sin-asignar",
            border: grupos.length > 0,
            header: (
              <>
                <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground/40" />
                <span className="text-sm font-medium text-muted-foreground">Sin asignar</span>
              </>
            ),
            body: (
              <ColumnaDia
                citas={sinAsignar}
                bloqueos={[]}
                sinAsignar
                fechaISO={fechaISO}
                doctoresTodos={doctoresTodos}
                colId="sin-asignar"
                doctorDestino={null}
                permiteDrag={permiteDrag}
                dragId={drag?.id ?? null}
                fantasma={fantasma}
                onDragStartCita={iniciarDrag}
                onFinDrag={finDrag}
                onDragOverColumna={dragOverColumna}
                onDragLeaveColumna={dragLeaveColumna}
                onDropColumna={dropColumna}
              />
            ),
          },
        ]
      : []),
  ];
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className="flex min-w-[760px]">
        <div className="w-14 shrink-0">
          <div className="h-10 border-b" />
          {HORAS.map((h) => (
            <div
              key={h}
              className="relative text-right text-xs tabular-nums text-muted-foreground"
              style={{ height: HORA_PX }}
            >
              <span className="absolute right-0 top-0 -translate-y-1/2 bg-card pr-1.5">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>
        {columnas.map((col) => (
          <div
            key={col.id}
            className={cn("flex min-w-44 flex-1 flex-col", col.border && "border-l")}
          >
            <div className="flex h-10 items-center justify-center gap-2 border-b bg-muted/20 px-3">
              {col.header}
            </div>
            {col.body}
          </div>
        ))}
      </div>
    </div>
  );
}
