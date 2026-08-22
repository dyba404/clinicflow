"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, FileText, FlaskConical, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/console/empty-state";
import { cn } from "@/lib/utils";

export type OrdenCola = {
  id: string;
  patientId: string;
  nombrePaciente: string;
  appointmentId: string | null;
  tipo: string;
  nombre: string;
  indicacion: string | null;
  estado: string;
  prioridad: number;
  resultado: unknown;
  motivoRevision: string | null;
  rev: number;
  createdAt: string;
};

const ESTADOS = [
  "ordenada",
  "toma",
  "procesada",
  "validada",
  "liberada",
  "entregada",
  "cancelada",
] as const;

const SIGUIENTE: Record<string, string | null> = {
  ordenada: "toma",
  toma: "procesada",
  procesada: "validada",
  validada: "liberada",
  liberada: "entregada",
  entregada: null,
  cancelada: null,
};

const ETIQUETA: Record<string, string> = {
  ordenada: "Ordenada",
  toma: "Toma de muestra",
  procesada: "Procesada",
  validada: "Validada",
  liberada: "Liberada",
  entregada: "Entregada",
  cancelada: "Cancelada",
};

const BADGE: Record<string, "gray" | "blue" | "violet" | "amber" | "teal" | "green" | "red"> = {
  ordenada: "gray",
  toma: "blue",
  procesada: "violet",
  validada: "amber",
  liberada: "teal",
  entregada: "green",
  cancelada: "red",
};

const TIPO_LABEL: Record<string, string> = {
  laboratorio: "Laboratorio",
  imagen: "Imagen",
};

export function OrdenesCola({ ordenes: iniciales }: { ordenes: OrdenCola[] }) {
  const router = useRouter();
  const [ordenes, setOrdenes] = useState<OrdenCola[]>(iniciales);
  const [filtro, setFiltro] = useState("todas");
  const [pending, start] = useTransition();
  const [dialogRes, setDialogRes] = useState<{ orden: OrdenCola; siguiente: string } | null>(null);
  const [resTexto, setResTexto] = useState("");
  const [dialogLab, setDialogLab] = useState<OrdenCola | null>(null);
  const [csvTexto, setCsvTexto] = useState("");

  const visibles = useMemo(
    () => (filtro === "todas" ? ordenes : ordenes.filter((o) => o.estado === filtro)),
    [ordenes, filtro],
  );

  function parche(orden: OrdenCola, body: Record<string, unknown>, etiquetaExito: string) {
    start(async () => {
      const res = await fetch(`/api/ordenes/${orden.id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo actualizar: ${j.error ?? "error"}`);
        return;
      }
      setOrdenes((prev) =>
        prev.map((o) => (o.id === orden.id ? { ...o, estado: j.estado } : o)),
      );
      toast.success(etiquetaExito);
      router.refresh();
    });
  }

  function avanzar(orden: OrdenCola) {
    const siguiente = SIGUIENTE[orden.estado];
    if (!siguiente) return;
    if ((siguiente === "validada" || siguiente === "liberada") && !orden.resultado) {
      setResTexto("");
      setDialogRes({ orden, siguiente });
      return;
    }
    parche(orden, { estado: siguiente }, `Orden avanzada a ${ETIQUETA[siguiente]}.`);
  }

  function cancelar(orden: OrdenCola) {
    parche(orden, { estado: "cancelada" }, "Orden cancelada.");
  }

  function guardarResultado() {
    if (!dialogRes) return;
    const texto = resTexto.trim();
    if (!texto) {
      toast.error("Escribe el resultado antes de continuar.");
      return;
    }
    const { orden, siguiente } = dialogRes;
    const copia = dialogRes;
    setDialogRes(null);
    start(async () => {
      const res = await fetch(`/api/ordenes/${orden.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultado: { valor: texto } }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDialogRes(copia);
        setResTexto(texto);
        toast.error(`No se pudo guardar el resultado: ${j.error ?? "error"}`);
        return;
      }
      setOrdenes((prev) =>
        prev.map((o) => (o.id === orden.id ? { ...o, resultado: { valor: texto } } : o)),
      );
      parche(orden, { estado: siguiente }, `Resultado guardado. Orden en ${ETIQUETA[siguiente]}.`);
    });
  }

  function abrirResultados(orden: OrdenCola) {
    setCsvTexto("");
    setDialogLab(orden);
  }

  function guardarCsv() {
    if (!dialogLab) return;
    const filas = csvTexto
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((linea) => {
        const [parametro = "", valor = "", unidad = "", referencia = "", flag = ""] = linea
          .split(";")
          .map((c) => c.trim());
        const valorNum = Number(valor);
        const esNumero = valor !== "" && Number.isFinite(valorNum) && /^-?\d+(\.\d+)?$/.test(valor);
        return {
          parametro,
          valorNum: esNumero ? valorNum : undefined,
          valorText: esNumero ? undefined : valor || undefined,
          unidad: unidad || undefined,
          referencia: referencia || undefined,
          flag: flag || undefined,
        };
      });
    if (filas.length === 0) {
      toast.error("Escribe al menos una fila (formato: parametro;valor;unidad;referencia).");
      return;
    }
    const invalida = filas.find((f) => !f.parametro || (!f.valorNum && !f.valorText));
    if (invalida) {
      toast.error("Cada fila necesita parámetro y al menos un valor.");
      return;
    }
    const orden = dialogLab;
    const copia = dialogLab;
    setDialogLab(null);
    start(async () => {
      const res = await fetch(`/api/ordenes/${orden.id}/resultados`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultados: filas }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDialogLab(copia);
        toast.error(`No se pudo guardar el resultado: ${j.error ?? "error"}`);
        return;
      }
      setOrdenes((prev) =>
        prev.map((o) =>
          o.id === orden.id ? { ...o, resultado: { filas: filas.length } } : o,
        ),
      );
      toast.success("Resultados cargados.");
      router.refresh();
    });
  }

  function abrirPdf(orden: OrdenCola) {
    window.open(`/api/ordenes/${orden.id}/resultado-pdf`, "_blank");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        {["todas", ...ESTADOS].map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setFiltro(e)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filtro === e
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {e === "todas" ? "Todas" : ETIQUETA[e]}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <EmptyCola vacio={ordenes.length === 0} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="h-9 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paciente</th>
                <th className="h-9 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo</th>
                <th className="h-9 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Orden</th>
                <th className="h-9 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                <th className="h-9 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prioridad</th>
                <th className="h-9 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fecha</th>
                <th className="h-9 px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((o) => {
                const siguiente = SIGUIENTE[o.estado] ?? null;
                return (
                  <tr key={o.id} className="border-b transition-colors hover:bg-muted/40">
                    <td className="px-3 py-2.5 font-medium">{o.nombrePaciente}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={o.tipo === "laboratorio" ? "blue" : "violet"}>
                        {TIPO_LABEL[o.tipo] ?? o.tipo}
                      </Badge>
                    </td>
                    <td className="max-w-[220px] px-3 py-2.5">
                      <p className="truncate font-medium">{o.nombre}</p>
                      {o.indicacion ? (
                        <p className="truncate text-xs text-muted-foreground">{o.indicacion}</p>
                      ) : null}
                      {o.motivoRevision ? (
                        <p className="truncate text-xs text-amber-700">Rev {o.rev}: {o.motivoRevision}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={BADGE[o.estado] ?? "gray"}>{ETIQUETA[o.estado] ?? o.estado}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={o.prioridad >= 2 ? "red" : o.prioridad === 1 ? "amber" : "gray"}>
                        P{o.prioridad}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{o.createdAt}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {o.tipo === "laboratorio" &&
                        ["procesada", "validada"].includes(o.estado) ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={pending}
                            onClick={() => abrirResultados(o)}
                          >
                            <FlaskConical className="size-3.5" />
                            Resultados
                          </Button>
                        ) : null}
                        {["liberada", "entregada"].includes(o.estado) ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={pending}
                            onClick={() => abrirPdf(o)}
                          >
                            <FileText className="size-3.5" />
                            PDF resultado
                          </Button>
                        ) : null}
                        {siguiente ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={pending}
                            onClick={() => avanzar(o)}
                          >
                            <ArrowRight className="size-3.5" />
                            {ETIQUETA[siguiente]}
                          </Button>
                        ) : null}
                        {o.estado !== "cancelada" && o.estado !== "entregada" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground"
                            disabled={pending}
                            onClick={() => cancelar(o)}
                          >
                            <XCircle className="size-3.5" />
                            Cancelar
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={dialogRes !== null}
        onClose={() => setDialogRes(null)}
        title="Cargar resultado"
        icon={<FlaskConical className="size-4 text-primary" />}
        description={`Necesario para avanzar la orden a ${dialogRes ? ETIQUETA[dialogRes.siguiente] : ""}.`}
      >
        <div className="space-y-4">
          <Textarea
            rows={5}
            value={resTexto}
            onChange={(e) => setResTexto(e.target.value)}
            placeholder="Valores, hallazgos o resumen del resultado…"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogRes(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={pending} onClick={guardarResultado}>
              Guardar y {dialogRes ? ETIQUETA[dialogRes.siguiente] : ""}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={dialogLab !== null}
        onClose={() => setDialogLab(null)}
        title="Resultados de laboratorio"
        icon={<FlaskConical className="size-4 text-primary" />}
        description={
          dialogLab
            ? `${dialogLab.nombre} · ${dialogLab.nombrePaciente}. Una fila por línea: parametro;valor;unidad;referencia;flag`
            : undefined
        }
      >
        <div className="space-y-4">
          <Textarea
            rows={8}
            value={csvTexto}
            onChange={(e) => setCsvTexto(e.target.value)}
            placeholder={"Glucosa;95;mg/dL;70-100\nHemoglobina;12.5;g/dL;12-16;H"}
            className="font-mono text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogLab(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={pending} onClick={guardarCsv}>
              Guardar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function EmptyCola({ vacio }: { vacio: boolean }) {
  return (
    <EmptyState
      icon={FlaskConical}
      title={vacio ? "Sin órdenes todavía" : "No hay órdenes con este estado"}
      description={
        vacio
          ? "Al crear una consulta podrás indicar exámenes de laboratorio o estudios de imagen."
          : "Cambia el filtro para ver el resto de la cola."
      }
    />
  );
}
