"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useNavegar } from "@/lib/navegar";
import {
  AlarmClock,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  LoaderCircle,
  Receipt,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
  HeartPulse,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PaletteSection {
  kind: "seccion";
  label: string;
  href: string;
  icon: LucideIcon;
}

interface PalettePatient {
  kind: "paciente";
  id: string;
  nombre: string;
  celular: string;
}

type PaletteItem = PaletteSection | PalettePatient;

const SECTIONS: PaletteSection[] = [
  { kind: "seccion", label: "Panel general", href: "/consola", icon: LayoutDashboard },
  { kind: "seccion", label: "Agenda del día", href: "/consola/agenda", icon: CalendarDays },
  { kind: "seccion", label: "Sala de espera", href: "/consola/sala-espera", icon: Inbox },
  { kind: "seccion", label: "Solicitudes", href: "/consola/solicitudes", icon: ClipboardList },
  { kind: "seccion", label: "Pacientes", href: "/consola/pacientes", icon: Users },
  { kind: "seccion", label: "Caja del día", href: "/consola/caja", icon: Wallet },
  { kind: "seccion", label: "Comprobantes", href: "/consola/caja/comprobantes", icon: Receipt },
  { kind: "seccion", label: "Ingresos", href: "/consola/dashboard", icon: ChartColumn },
  { kind: "seccion", label: "Recall", href: "/consola/recall", icon: AlarmClock },
  { kind: "seccion", label: "Personal", href: "/consola/personal", icon: HeartPulse },
  { kind: "seccion", label: "Auditoría", href: "/consola/auditoria", icon: ShieldCheck },
];

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const ir = useNavegar();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const requestIdRef = useRef(0);
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PalettePatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setPatients([]);
      setLoading(false);
      setSelected(0);
    }
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setPatients([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pacientes?q=${encodeURIComponent(q)}`);
        if (id !== requestIdRef.current) return;
        if (!res.ok) {
          setPatients([]);
          return;
        }
        const data = (await res.json()) as {
          pacientes: { id: string; nombre: string; celular: string }[];
        };
        setPatients(
          data.pacientes.map((p) => ({ kind: "paciente" as const, ...p })),
        );
      } catch {
        if (id === requestIdRef.current) setPatients([]);
      } finally {
        if (id === requestIdRef.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const secciones = q
      ? SECTIONS.filter((s) => s.label.toLowerCase().includes(q))
      : SECTIONS;
    return q && !loading ? [...secciones, ...patients] : secciones;
  }, [query, patients, loading]);

  useEffect(() => {
    setSelected(0);
  }, [query, items.length]);

  useEffect(() => {
    const el = listRef.current?.children[selected];
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const execute = useCallback(
    (item: PaletteItem) => {
      onClose();
      if (item.kind === "seccion") router.push(item.href);
      else ir(`/consola/pacientes?q=${encodeURIComponent(item.nombre)}`);
    },
    [onClose, router, ir],
  );

  if (!open) return null;

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => (items.length ? (s + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => (items.length ? (s - 1 + items.length) % items.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[selected];
      if (item) execute(item);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[15vh]"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border bg-card shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="relative border-b">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Buscar pacientes o secciones…"
            className="h-12 w-full bg-transparent pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 && loading ? (
            <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Buscando pacientes…
            </p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">
              Sin resultados para &quot;{query.trim()}&quot;
            </p>
          ) : (
            <ul ref={listRef}>
              {items.map((item, i) => {
                const Icon = item.kind === "seccion" ? item.icon : UserRound;
                const label = item.kind === "seccion" ? item.label : item.nombre;
                const detail = item.kind === "seccion" ? item.href : item.celular;
                return (
                  <li key={item.kind === "seccion" ? item.href : item.id}>
                    <button
                      type="button"
                      onClick={() => execute(item)}
                      onMouseEnter={() => setSelected(i)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm",
                        i === selected
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{label}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {detail}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-sans">↑</kbd>
            <kbd className="rounded border bg-muted px-1 py-0.5 font-sans">↓</kbd>
            navegar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-sans">Enter</kbd>
            abrir
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-sans">Esc</kbd>
            cerrar
          </span>
        </div>
      </div>
    </div>
  );
}
