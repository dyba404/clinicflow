"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePlus2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtPEN } from "@/lib/format";

interface PacienteOpcion {
  id: string;
  nombre: string;
  celular: string;
}

interface FilaItem {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
}

function filaVacia(): FilaItem {
  return { descripcion: "", cantidad: "1", precioUnitario: "" };
}

export function NuevoPresupuestoDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [q, setQ] = useState("");
  const [opciones, setOpciones] = useState<PacienteOpcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [paciente, setPaciente] = useState<PacienteOpcion | null>(null);
  const [listaVisible, setListaVisible] = useState(false);
  const buscarRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [titulo, setTitulo] = useState("");
  const [items, setItems] = useState<FilaItem[]>([filaVacia()]);
  const [expiraEn, setExpiraEn] = useState("");
  const [nota, setNota] = useState("");

  const total = useMemo(() => {
    return items.reduce((acc, it) => {
      const cant = Number(it.cantidad);
      const precio = Number(it.precioUnitario);
      if (!Number.isFinite(cant) || cant <= 0) return acc;
      if (!Number.isFinite(precio) || precio < 0) return acc;
      return acc + cant * precio;
    }, 0);
  }, [items]);

  useEffect(() => {
    if (!open) return;
    if (!q.trim()) {
      setOpciones([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    if (buscarRef.current) clearTimeout(buscarRef.current);
    buscarRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/pacientes?q=${encodeURIComponent(q.trim())}`);
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          setOpciones(j.pacientes ?? []);
          setListaVisible(true);
        } else {
          setOpciones([]);
        }
      } catch {
        setOpciones([]);
      } finally {
        setBuscando(false);
      }
    }, 250);
    return () => {
      if (buscarRef.current) clearTimeout(buscarRef.current);
    };
  }, [q, open]);

  function limpiar() {
    setQ("");
    setOpciones([]);
    setPaciente(null);
    setListaVisible(false);
    setTitulo("");
    setItems([filaVacia()]);
    setExpiraEn("");
    setNota("");
  }

  function setFila(i: number, campo: keyof FilaItem, valor: string) {
    setItems((prev) => prev.map((f, idx) => (idx === i ? { ...f, [campo]: valor } : f)));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!paciente) {
      toast.error("Selecciona un paciente para el presupuesto");
      return;
    }
    if (items.length === 0) {
      toast.error("Agrega al menos un ítem");
      return;
    }
    start(async () => {
      const res = await fetch("/api/presupuestos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: paciente.id,
          titulo: titulo.trim(),
          items: items
            .filter((it) => it.descripcion.trim() !== "")
            .map((it) => ({
              descripcion: it.descripcion.trim(),
              cantidad: Number(it.cantidad),
              precioUnitario: Number(it.precioUnitario),
            })),
          expiraEn: expiraEn || null,
          nota: nota.trim() || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo crear el presupuesto: ${j.error ?? "error"}`);
        return;
      }
      toast.success(`Presupuesto creado: ${titulo.trim()} (${fmtPEN(total)})`);
      setOpen(false);
      limpiar();
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <FilePlus2 className="size-4" />
        Nuevo presupuesto
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo presupuesto"
        icon={<FilePlus2 className="size-4 text-primary" />}
        description="Busca al paciente, agrega los servicios y guarda como borrador."
        className="max-w-2xl"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="relative space-y-1.5">
            <Label htmlFor="np-paciente">Paciente</Label>
            {paciente ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">
                  {paciente.nombre} <span className="text-muted-foreground">· {paciente.celular}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPaciente(null);
                    setQ("");
                  }}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="np-paciente"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nombre, celular o documento…"
                  className="pl-9"
                  autoComplete="off"
                />
                {listaVisible && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-card shadow-md">
                    {buscando ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p>
                    ) : opciones.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
                    ) : (
                      opciones.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            setPaciente(p);
                            setListaVisible(false);
                          }}
                        >
                          {p.nombre} <span className="text-muted-foreground">· {p.celular}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-titulo">Título del presupuesto</Label>
            <Input
              id="np-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              maxLength={80}
              placeholder="Plan de tratamiento, blanqueamiento…"
            />
          </div>

          <div className="space-y-2">
            <Label>Ítems del presupuesto</Label>
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_72px_110px_32px] items-center gap-2 text-xs font-medium text-muted-foreground">
                <span>Descripción</span>
                <span>Cant.</span>
                <span>Precio (S/)</span>
                <span />
              </div>
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_72px_110px_32px] items-center gap-2">
                  <Input
                    value={it.descripcion}
                    onChange={(e) => setFila(i, "descripcion", e.target.value)}
                    required
                    maxLength={120}
                    placeholder="Consulta general"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={it.cantidad}
                    onChange={(e) => setFila(i, "cantidad", e.target.value)}
                    required
                    className="tabular-nums"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={it.precioUnitario}
                    onChange={(e) => setFila(i, "precioUnitario", e.target.value)}
                    required
                    className="tabular-nums"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={items.length === 1}
                    onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label="Quitar ítem"
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItems((prev) => [...prev, filaVacia()])}
            >
              <Plus className="size-4" />
              Agregar ítem
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-expira">Vence el (opcional)</Label>
              <Input
                id="np-expira"
                type="date"
                value={expiraEn}
                onChange={(e) => setExpiraEn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Total</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-semibold tabular-nums">
                {fmtPEN(total)}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-nota">Nota (opcional)</Label>
            <Input
              id="np-nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={500}
              placeholder="Condiciones, incluye control…"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creando…" : "Crear presupuesto"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
