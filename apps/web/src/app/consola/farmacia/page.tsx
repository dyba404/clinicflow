"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Boxes, Pill } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/console/empty-state";

interface PacienteResult {
  id: string;
  nombre: string;
  celular: string;
}

interface ItemInv {
  id: string;
  nombre: string;
  unidad: string;
  stock: string;
}

interface LoteDisponible {
  id: string;
  lote: string;
  vence: string | null;
  cantidad: string;
}

interface Dispensacion {
  id: string;
  itemNombre: string;
  cantidad: string;
  lote: string | null;
  createdAt: string;
}

export default function FarmaciaPage() {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<PacienteResult[]>([]);
  const [paciente, setPaciente] = useState<PacienteResult | null>(null);
  const [items, setItems] = useState<ItemInv[]>([]);
  const [itemId, setItemId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [lotes, setLotes] = useState<LoteDisponible[]>([]);
  const [lotId, setLotId] = useState("auto");
  const [dispensaciones, setDispensaciones] = useState<Dispensacion[]>([]);
  const [cargandoLotes, setCargandoLotes] = useState(false);
  const [pending, start] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/inventario/items");
      const j = (await r.json().catch(() => ({}))) as { items?: ItemInv[] };
      if (r.ok) setItems((j.items ?? []).filter((i) => Number(i.stock) > 0));
    })();
  }, []);

  const cargarDispensaciones = useCallback(async (pid: string) => {
    const r = await fetch(`/api/farmacia/dispensaciones?patientId=${encodeURIComponent(pid)}`);
    const j = (await r.json().catch(() => ({}))) as { dispensaciones?: Dispensacion[] };
    setDispensaciones(r.ok ? (j.dispensaciones ?? []) : []);
  }, []);

  const cargarLotes = useCallback(async (iid: string) => {
    setCargandoLotes(true);
    try {
      const r = await fetch(`/api/farmacia/disponibles?itemId=${encodeURIComponent(iid)}`);
      const j = (await r.json().catch(() => ({}))) as { disponibles?: LoteDisponible[] };
      setLotes(r.ok ? (j.disponibles ?? []) : []);
    } finally {
      setCargandoLotes(false);
    }
  }, []);

  function buscar(texto: string) {
    setQ(texto);
    setPaciente(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (texto.trim().length < 1) {
      setResultados([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/pacientes?q=${encodeURIComponent(texto.trim())}`);
        const j = (await r.json().catch(() => ({}))) as { pacientes?: PacienteResult[] };
        setResultados(r.ok ? (j.pacientes ?? []) : []);
      } catch {
        setResultados([]);
      }
    }, 250);
  }

  function elegirPaciente(p: PacienteResult) {
    setPaciente(p);
    setResultados([]);
    setQ(`${p.nombre} · ${p.celular}`);
    cargarDispensaciones(p.id);
  }

  function limpiarPaciente() {
    setPaciente(null);
    setQ("");
    setResultados([]);
    setDispensaciones([]);
  }

  function onItemChange(iid: string) {
    setItemId(iid);
    setLotId("auto");
    setLotes([]);
    if (iid) cargarLotes(iid);
  }

  function aplicar() {
    if (!paciente) {
      toast.error("Busca y selecciona un paciente primero.");
      return;
    }
    if (!itemId) {
      toast.error("Selecciona un artículo.");
      return;
    }
    const cant = Number(cantidad);
    if (!Number.isFinite(cant) || cant <= 0) {
      toast.error("Ingresa una cantidad válida mayor a cero.");
      return;
    }
    start(async () => {
      const r = await fetch("/api/farmacia/dispensar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: paciente.id,
          itemId,
          cantidad: cant,
          lotId: lotId === "auto" ? undefined : lotId,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        toast.error(
          j.error === "stock_insuficiente_o_vencido"
            ? "Sin stock disponible en lotes vigentes para esa cantidad."
            : `No se pudo dispensar: ${j.error ?? "error"}`,
        );
        return;
      }
      toast.success("Dispensa registrada.");
      setCantidad("");
      setLotId("auto");
      cargarDispensaciones(paciente.id);
      cargarLotes(itemId);
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">Farmacia</h2>
          <p className="mt-0.5 max-w-2xl text-[13px] text-muted-foreground">
            Dispensa de farmacia interna con salida FEFO por lote.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm font-medium">Paciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            {!paciente ? (
              <>
                <Input
                  value={q}
                  onChange={(e) => buscar(e.target.value)}
                  placeholder="Busca por nombre, celular o documento…"
                  autoComplete="off"
                />
                {resultados.length > 0 ? (
                  <div className="overflow-hidden rounded-md border">
                    {resultados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                        onClick={() => elegirPaciente(p)}
                      >
                        <span className="font-medium">{p.nombre}</span>
                        <span className="ml-2 text-muted-foreground">{p.celular}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{paciente.nombre}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={limpiarPaciente}
                >
                  Cambiar paciente
                </Button>
              </div>
            )}

            {paciente ? (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Dispensado a este paciente
                </p>
                {dispensaciones.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">Sin dispensas todavía.</p>
                ) : (
                  <ul className="divide-y">
                    {dispensaciones.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{d.itemNombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.lote ? `Lote ${d.lote} · ` : ""}
                            {formatDistanceToNow(new Date(d.createdAt), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </p>
                        </div>
                        <Badge variant="teal">{Number(d.cantidad)}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Pill className="size-4 text-primary" />
              Dispensar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5 pt-0">
            <div className="space-y-1.5">
              <Label>Artículo</Label>
              <Select value={itemId} onChange={(e) => onItemChange(e.target.value)}>
                <option value="">Selecciona un artículo…</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({Number(i.stock)} {i.unidad} en stock)
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="1"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Lote (FEFO)</Label>
              <Select
                value={lotId}
                onChange={(e) => setLotId(e.target.value)}
                disabled={!itemId || cargandoLotes}
              >
                <option value="auto">Auto: el que vence primero</option>
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.lote} (vence {l.vence ? format(new Date(`${l.vence}T12:00:00`), "d MMM yyyy", { locale: es }) : "sin fecha"}) x{Number(l.cantidad)}
                  </option>
                ))}
              </Select>
              {itemId && lotes.length === 0 && !cargandoLotes ? (
                <p className="text-xs text-muted-foreground">
                  Sin lotes vigentes con stock. Se intentará descontar del stock total.
                </p>
              ) : null}
            </div>

            <Button type="button" disabled={pending || !paciente || !itemId} onClick={aplicar}>
              {pending ? "Aplicando…" : "Aplicar"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Boxes}
            title="Sin artículos con stock"
            description="Registra ingresos de inventario para poder dispensar desde farmacia."
          />
        </Card>
      ) : null}
    </div>
  );
}
