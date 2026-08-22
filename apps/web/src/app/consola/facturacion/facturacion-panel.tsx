"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusCircle, Receipt, ShieldPlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ConvenioFila {
  id: string;
  insurerId: string;
  nombreAseguradora: string;
  tipo: string;
  descuentoNum: number;
  activo: boolean;
}

export interface ItemFactura {
  concepto: string;
  cantidad: number;
  precio: number;
}

export interface FacturaFila {
  id: string;
  patientId: string;
  nombrePaciente: string;
  convenioId: string | null;
  nombreConvenio: string | null;
  admissionId: string | null;
  items: ItemFactura[];
  totalNum: number;
  estado: string;
  emitidaAt: string | null;
  pagadaAt: string | null;
  anuladaMotivo: string | null;
  createdAt: string;
}

interface AseguradoraOpcion {
  id: string;
  nombre: string;
  activo: boolean;
}

interface PacienteOpcion {
  id: string;
  nombre: string;
  celular: string;
}

const ESTADOS = ["borrador", "emitida", "pagada", "anulada"] as const;

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  emitida: "Emitida",
  pagada: "Pagada",
  anulada: "Anulada",
};

const ESTADO_BADGE: Record<string, "gray" | "blue" | "green" | "red"> = {
  borrador: "gray",
  emitida: "blue",
  pagada: "green",
  anulada: "red",
};

const TIPOS_CONVENIO = ["EPS", "Seguro", "Convenio directo"];

const ERROR_MSG: Record<string, string> = {
  json_invalido: "Datos inválidos.",
  faltan_datos: "Faltan datos obligatorios.",
  tipo_in: "El tipo de convenio debe tener al menos 2 caracteres.",
  descuento_invalido: "El descuento debe estar entre 0 y 100.",
  aseguradora_no_encontrada: "La aseguradora ya no existe en este equipo.",
  convenio_duplicado: "Esta aseguradora ya tiene un convenio activo.",
  convenio_no_encontrado: "El convenio ya no existe en este equipo.",
  convenio_con_facturas: "No se puede desactivar un convenio con facturas emitidas.",
  paciente_no_encontrado: "El paciente ya no existe en este equipo.",
  admision_no_encontrada: "La admisión ya no existe en este equipo.",
  items_invalidos: "Los ítems no son válidos (1 a 50, concepto de 2+ caracteres).",
  total_incoherente: "El total enviado no coincide con la suma de los ítems.",
  factura_no_encontrada: "La factura ya no existe.",
  estado_invalido: "El estado no es válido.",
  transicion_invalida: "Ese cambio de estado no está permitido.",
  motivo_requerido: "Indica el motivo de la anulación (3+ caracteres).",
  sin_sesion: "Tu sesión expiró. Vuelve a iniciar sesión.",
  sin_permiso: "No tienes permiso para esta acción.",
};

function errorDe(j: { error?: string } | null): string {
  const clave = j?.error ?? "";
  return ERROR_MSG[clave] ?? clave ?? "error";
}

function fmtFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function filaVacia() {
  return { concepto: "", cantidad: "1", precio: "" };
}

export function FacturacionPanel({
  convenios,
  facturas,
}: {
  convenios: ConvenioFila[];
  facturas: FacturaFila[];
}) {
  const [tab, setTab] = useState<"convenios" | "facturas">("facturas");
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);
  const [dialogConvenio, setDialogConvenio] = useState(false);
  const [dialogFactura, setDialogFactura] = useState(false);
  const [dialogDetalle, setDialogDetalle] = useState<FacturaFila | null>(null);

  const filtradas = filtroEstado
    ? facturas.filter((f) => f.estado === filtroEstado)
    : facturas;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-full border bg-card p-1">
          {(
            [
              { v: "convenios", label: "Convenios" },
              { v: "facturas", label: "Facturas" },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setTab(o.v)}
              aria-pressed={tab === o.v}
              className={cn(
                "min-h-9 [@media(pointer:coarse)]:min-h-12 [@media(pointer:coarse)]:text-sm",
                tab === o.v
                  ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                  : "rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {tab === "convenios" ? (
          <Button size="sm" onClick={() => setDialogConvenio(true)}>
            <ShieldPlus className="size-4" />
            Nuevo convenio
          </Button>
        ) : (
          <Button size="sm" onClick={() => setDialogFactura(true)}>
            <PlusCircle className="size-4" />
            Nueva factura
          </Button>
        )}
      </div>

      {tab === "convenios" ? (
        <div className="rounded-2xl border bg-card">
          <div className="flex items-center justify-between gap-2 border-b p-4">
            <h3 className="text-sm font-semibold">Convenios activos con aseguradoras</h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {convenios.filter((c) => c.activo).length} de {convenios.length}
            </span>
          </div>
          {convenios.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              Sin convenios todavía. Crea el primero con el botón “Nuevo convenio”.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aseguradora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Descuento %</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {convenios.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm font-medium">{c.nombreAseguradora}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.tipo}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{c.descuentoNum}%</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={c.activo ? "green" : "gray"}>
                          {c.activo ? "Activo" : "Inactivo"}
                        </Badge>
                        <ButtonConvenioActivo convenio={c} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-1 rounded-full border bg-card p-1">
            {([{ v: null, label: "Todas" }] as { v: string | null; label: string }[])
              .concat(ESTADOS.map((e) => ({ v: e as string | null, label: ESTADO_LABEL[e] ?? e })))
              .map((o) => (
                <button
                  key={o.v ?? "todas"}
                  type="button"
                  onClick={() => setFiltroEstado(o.v)}
                  className={cn(
                    "min-h-9 [@media(pointer:coarse)]:min-h-12 [@media(pointer:coarse)]:text-sm",
                    filtroEstado === o.v
                      ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                      : "rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {o.label}
                </button>
              ))}
          </div>

          <div className="rounded-2xl border bg-card">
            {filtradas.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                No hay facturas con este filtro.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead className="text-right">Total S/</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Convenio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((f) => (
                    <TableRow
                      key={f.id}
                      className="cursor-pointer"
                      onClick={() => setDialogDetalle(f)}
                    >
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {fmtFecha(f.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{f.nombrePaciente}</TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">
                        {f.totalNum.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ESTADO_BADGE[f.estado] ?? "gray"}>
                          {ESTADO_LABEL[f.estado] ?? f.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {f.nombreConvenio ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}

      <DialogNuevoConvenio
        key={dialogConvenio ? "abierta" : "cerrada"}
        open={dialogConvenio}
        onClose={() => setDialogConvenio(false)}
      />
      <DialogNuevaFactura
        key={dialogFactura ? "abierta" : "cerrada"}
        open={dialogFactura}
        convenios={convenios.filter((c) => c.activo)}
        onClose={() => setDialogFactura(false)}
      />
      {dialogDetalle ? (
        <DialogDetalleFactura
          key={dialogDetalle.id}
          factura={dialogDetalle}
          onClose={() => setDialogDetalle(null)}
        />
      ) : null}
    </div>
  );
}

function ButtonConvenioActivo({ convenio }: { convenio: ConvenioFila }) {
  const router = useRouter();

  async function toggle() {
    const res = await fetch(`/api/facturacion/convenios/${convenio.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !convenio.activo }),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !j?.ok) {
      toast.error(`No se pudo actualizar el convenio: ${errorDe(j)}`);
      return;
    }
    toast.success(`Convenio ${convenio.activo ? "desactivado" : "activado"}.`);
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle}>
      {convenio.activo ? "Desactivar" : "Activar"}
    </Button>
  );
}

function DialogNuevoConvenio({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [aseguradoras, setAseguradoras] = useState<AseguradoraOpcion[]>([]);
  const [insurerId, setInsurerId] = useState("");
  const [tipo, setTipo] = useState(TIPOS_CONVENIO[0] ?? "EPS");
  const [descuento, setDescuento] = useState("0");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    let activo = true;
    (async () => {
      try {
        const r = await fetch("/api/aseguradoras");
        const j = (await r.json().catch(() => ({}))) as { aseguradoras?: AseguradoraOpcion[] };
        if (activo && r.ok) setAseguradoras(j.aseguradoras ?? []);
      } catch {
        if (activo) setAseguradoras([]);
      }
    })();
    return () => {
      activo = false;
    };
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!insurerId) {
      toast.error("Selecciona una aseguradora.");
      return;
    }
    const desc = Number(descuento);
    if (!Number.isFinite(desc) || desc < 0 || desc > 100) {
      toast.error("El descuento debe estar entre 0 y 100.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/facturacion/convenios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insurerId, tipo, descuentoPct: desc }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) {
        toast.error(`No se pudo crear el convenio: ${errorDe(j)}`);
        return;
      }
      toast.success("Convenio creado.");
      onClose();
      router.refresh();
    } catch {
      toast.error("No se pudo crear el convenio.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nuevo convenio"
      icon={<ShieldPlus className="size-4 text-primary" />}
      description="Vincula una aseguradora con un tipo de convenio y un descuento institucional."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fav-aseguradora">Aseguradora</Label>
          <Select
            id="fav-aseguradora"
            value={insurerId}
            onChange={(e) => setInsurerId(e.target.value)}
          >
            <option value="">Selecciona una aseguradora…</option>
            {aseguradoras.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.activo}>
                {a.nombre}
                {!a.activo ? " (inactiva)" : ""}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fav-tipo">Tipo</Label>
            <Select id="fav-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_CONVENIO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fav-descuento">Descuento (%)</Label>
            <Input
              id="fav-descuento"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={descuento}
              onChange={(e) => setDescuento(e.target.value)}
              className="tabular-nums"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? "Creando…" : "Crear convenio"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DialogNuevaFactura({
  open,
  convenios,
  onClose,
}: {
  open: boolean;
  convenios: ConvenioFila[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [opciones, setOpciones] = useState<PacienteOpcion[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [convenioId, setConvenioId] = useState("");
  const [usarDescuento, setUsarDescuento] = useState(true);
  const [items, setItems] = useState<Array<{ concepto: string; cantidad: string; precio: string }>>([
    filaVacia(),
  ]);
  const [guardando, setGuardando] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const convenio = convenios.find((c) => c.id === convenioId) ?? null;

  const subtotal = useMemo(
    () =>
      items.reduce((acc, it) => {
        const cantidad = Number(it.cantidad);
        const precio = Number(it.precio);
        if (!Number.isFinite(cantidad) || !Number.isFinite(precio)) return acc;
        return acc + cantidad * precio;
      }, 0),
    [items],
  );

  const descuentoMonto =
    convenio && usarDescuento
      ? Math.round(subtotal * convenio.descuentoNum) / 100
      : 0;
  const totalFinal = Math.round((subtotal - descuentoMonto) * 100) / 100;

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

  function setFila(i: number, campo: "concepto" | "cantidad" | "precio", valor: string) {
    setItems((filas) => filas.map((f, idx) => (idx === i ? { ...f, [campo]: valor } : f)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!patientId) {
      toast.error("Busca y selecciona un paciente de la lista.");
      return;
    }
    const enviados: Array<{ concepto: string; cantidad: number; precio: number }> = [];
    for (const it of items) {
      const concepto = it.concepto.trim();
      const cantidad = Number(it.cantidad);
      const precio = Number(it.precio);
      if (!concepto || concepto.length < 2) {
        toast.error("Cada concepto debe tener al menos 2 caracteres.");
        return;
      }
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        toast.error("La cantidad debe ser un número mayor a 0.");
        return;
      }
      if (!Number.isFinite(precio) || precio < 0) {
        toast.error("El precio debe ser un número igual o mayor a 0.");
        return;
      }
      enviados.push({ concepto, cantidad, precio });
    }
    if (enviados.length < 1) {
      toast.error("Agrega al menos un ítem.");
      return;
    }
    if (convenio && usarDescuento && descuentoMonto > 0) {
      enviados.push({
        concepto: `Descuento convenio (${convenio.descuentoNum}%)`,
        cantidad: 1,
        precio: -descuentoMonto,
      });
    }
    if (totalFinal < 0) {
      toast.error("El total no puede ser negativo.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/facturacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          convenioId: convenioId || null,
          items: enviados,
          total: totalFinal,
        }),
      });
      const j = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok) {
        toast.error(`No se pudo crear la factura: ${errorDe(j)}`);
        return;
      }
      toast.success("Factura borrador creada.");
      onClose();
      router.refresh();
    } catch {
      toast.error("No se pudo crear la factura.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nueva factura"
      icon={<Receipt className="size-4 text-primary" />}
      description="Los ítems se guardan como borrador; podrás emitirla y cobrarla después."
      className="max-w-2xl"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fac-paciente">Paciente</Label>
            <Input
              id="fac-paciente"
              value={q}
              onChange={(e) => buscar(e.target.value)}
              placeholder="Busca por nombre o documento…"
              autoComplete="off"
              list="fac-pacientes"
            />
            <datalist id="fac-pacientes">
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
            <Label htmlFor="fac-convenio">Convenio (opcional)</Label>
            <Select
              id="fac-convenio"
              value={convenioId}
              onChange={(e) => {
                setConvenioId(e.target.value);
                setUsarDescuento(true);
              }}
            >
              <option value="">Sin convenio</option>
              {convenios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombreAseguradora} · {c.tipo}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_80px_110px_90px_32px] items-center gap-2 text-xs text-muted-foreground">
            <span>Concepto</span>
            <span>Cant.</span>
            <span>Precio (S/)</span>
            <span className="text-right">Subtotal</span>
            <span />
          </div>
          {items.map((it, i) => {
            const cantidad = Number(it.cantidad);
            const precio = Number(it.precio);
            const linea =
              Number.isFinite(cantidad) && Number.isFinite(precio) ? cantidad * precio : 0;
            return (
              <div key={i} className="grid grid-cols-[1fr_80px_110px_90px_32px] items-center gap-2">
                <Input
                  value={it.concepto}
                  onChange={(e) => setFila(i, "concepto", e.target.value)}
                  placeholder="Concepto…"
                />
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={it.cantidad}
                  onChange={(e) => setFila(i, "cantidad", e.target.value)}
                  className="tabular-nums"
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={it.precio}
                  onChange={(e) => setFila(i, "precio", e.target.value)}
                  className="tabular-nums"
                />
                <span className="text-right text-sm tabular-nums">{linea.toFixed(2)}</span>
                <button
                  type="button"
                  aria-label="Quitar ítem"
                  disabled={items.length === 1}
                  onClick={() => setItems((filas) => filas.filter((_, idx) => idx !== i))}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((filas) => [...filas, filaVacia()])}
          >
            <PlusCircle className="size-4" />
            Agregar ítem
          </Button>
        </div>

        {convenio ? (
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={usarDescuento}
                onChange={(e) => setUsarDescuento(e.target.checked)}
              />
              Aplicar descuento convenio
            </label>
            {usarDescuento ? (
              <Badge variant="violet">Descuento {convenio.descuentoNum}%</Badge>
            ) : (
              <Badge variant="gray">Sin descuento</Badge>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-sm font-semibold tabular-nums">S/ {totalFinal.toFixed(2)}</span>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? "Creando…" : "Crear borrador"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DialogDetalleFactura({
  factura,
  onClose,
}: {
  factura: FacturaFila;
  onClose: () => void;
}) {
  const router = useRouter();
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [pendiente, setPendiente] = useState(false);

  async function cambiarEstado(estado: string) {
    const payload: Record<string, unknown> = { estado };
    if (estado === "anulada") {
      if (motivoAnulacion.trim().length < 3) {
        toast.error("Indica el motivo de la anulación (3+ caracteres).");
        return;
      }
      payload.motivoPago = motivoAnulacion.trim();
    }
    setPendiente(true);
    try {
      const res = await fetch(`/api/facturacion/${factura.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) {
        toast.error(`No se pudo actualizar la factura: ${errorDe(j)}`);
        return;
      }
      toast.success(`Factura ${ESTADO_LABEL[estado] ?? estado}.`);
      onClose();
      router.refresh();
    } catch {
      toast.error("No se pudo actualizar la factura.");
    } finally {
      setPendiente(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Detalle de factura"
      icon={<Receipt className="size-4 text-primary" />}
      description={`${factura.nombrePaciente} · ${fmtFecha(factura.createdAt)}`}
      className="max-w-xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={ESTADO_BADGE[factura.estado] ?? "gray"}>
            {ESTADO_LABEL[factura.estado] ?? factura.estado}
          </Badge>
          {factura.nombreConvenio ? (
            <Badge variant="violet">{factura.nombreConvenio}</Badge>
          ) : null}
          {factura.anuladaMotivo ? (
            <span className="text-xs text-muted-foreground">
              Motivo anulación: {factura.anuladaMotivo}
            </span>
          ) : null}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {factura.items.map((it, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm">{it.concepto}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{it.cantidad}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{it.precio.toFixed(2)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {(it.cantidad * it.precio).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-base font-semibold tabular-nums">S/ {factura.totalNum.toFixed(2)}</span>
        </div>

        {factura.estado === "anulada" ? null : (
          <div className="space-y-2">
            {factura.estado === "emitida" ? (
              <div className="space-y-1.5">
                <Label htmlFor="det-motivo">Motivo de anulación</Label>
                <Textarea
                  id="det-motivo"
                  rows={2}
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  placeholder="Motivo de la anulación…"
                />
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              {factura.estado === "borrador" ? (
                <Button onClick={() => cambiarEstado("emitida")} disabled={pendiente}>
                  Emitir
                </Button>
              ) : null}
              {factura.estado === "emitida" ? (
                <>
                  <Button variant="outline" onClick={() => cambiarEstado("anulada")} disabled={pendiente}>
                    Anular
                  </Button>
                  <Button onClick={() => cambiarEstado("pagada")} disabled={pendiente}>
                    Registrar pagada
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
