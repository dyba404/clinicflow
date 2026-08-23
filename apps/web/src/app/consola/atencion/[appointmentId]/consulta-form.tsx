"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Activity,
  ClipboardList,
  Eye,
  EyeOff,
  FlaskConical,
  Plus,
  Save,
  Stethoscope,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Cie10Autocomplete } from "@/components/console/cie10-autocomplete";
import { cn } from "@/lib/utils";

type DiagnosticoConsulta = {
  codigo: string;
  descripcion: string | null;
  esPrincipal: boolean;
  ocultoPortal: boolean;
};
type RecetaConsulta = {
  id: string;
  medicamento: string;
  dosis: string | null;
  frecuencia: string | null;
  duracionDias: number | null;
  indicaciones: string | null;
};

export type ConsultaInicial = {
  id: string;
  motivoConsulta: string | null;
  subjetivo: string | null;
  objetivo: string | null;
  evaluacion: string | null;
  plan: string | null;
  constantes: Record<string, string> | null;
  publicadoAt: string | null;
  publicarNota: boolean;
  diagnosticos: DiagnosticoConsulta[];
  recetas: RecetaConsulta[];
};

export type OrdenInicial = {
  id: string;
  tipo: string;
  nombre: string;
  indicacion: string | null;
  estado: string;
  prioridad: number;
};

const ESTADO_ORDEN: Record<string, string> = {
  ordenada: "Ordenada",
  toma: "Toma de muestra",
  procesada: "Procesada",
  validada: "Validada",
  liberada: "Liberada",
  entregada: "Entregada",
  cancelada: "Cancelada",
};

type FilaReceta = { medicamento: string; dosis: string; frecuencia: string; duracion: string };

export function ConsultaAtencion({
  patientId,
  appointmentId,
  consultaInicial,
  ordenesIniciales,
  puedeCrearOrdenes,
}: {
  patientId: string;
  appointmentId: string;
  consultaInicial: ConsultaInicial | null;
  ordenesIniciales: OrdenInicial[];
  puedeCrearOrdenes: boolean;
}) {
  const router = useRouter();
  const [consultaId, setConsultaId] = useState<string | null>(consultaInicial?.id ?? null);
  const [guardando, start] = useTransition();

  const [motivo, setMotivo] = useState(consultaInicial?.motivoConsulta ?? "");
  const [subjetivo, setSubjetivo] = useState(consultaInicial?.subjetivo ?? "");
  const [objetivo, setObjetivo] = useState(consultaInicial?.objetivo ?? "");
  const [evaluacion, setEvaluacion] = useState(consultaInicial?.evaluacion ?? "");
  const [plan, setPlan] = useState(consultaInicial?.plan ?? "");
  const constantesIni = consultaInicial?.constantes ?? {};
  const [peso, setPeso] = useState(constantesIni.peso ?? "");
  const [temperatura, setTemperatura] = useState(constantesIni.temperatura ?? "");
  const [pa, setPa] = useState(constantesIni.pa ?? "");
  const [fc, setFc] = useState(constantesIni.fc ?? "");

  const [diagnosticos, setDiagnosticos] = useState<DiagnosticoConsulta[]>(
    consultaInicial?.diagnosticos ?? [],
  );
  const [recetas, setRecetas] = useState<RecetaConsulta[]>(consultaInicial?.recetas ?? []);
  const [filasReceta, setFilasReceta] = useState<FilaReceta[]>([
    { medicamento: "", dosis: "", frecuencia: "", duracion: "" },
  ]);
  const [ordenes, setOrdenes] = useState<OrdenInicial[]>(ordenesIniciales);
  const [ordenTipo, setOrdenTipo] = useState("laboratorio");
  const [ordenNombre, setOrdenNombre] = useState("");
  const [ordenIndicacion, setOrdenIndicacion] = useState("");
  const [ordenPrioridad, setOrdenPrioridad] = useState("0");

  const [publicadoAt, setPublicadoAt] = useState<string | null>(consultaInicial?.publicadoAt ?? null);
  const [publicarNota, setPublicarNota] = useState(consultaInicial?.publicarNota ?? false);

  function guardarConsulta(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      const constantes: Record<string, string> = {};
      if (peso.trim()) constantes.peso = peso.trim();
      if (temperatura.trim()) constantes.temperatura = temperatura.trim();
      if (pa.trim()) constantes.pa = pa.trim();
      if (fc.trim()) constantes.fc = fc.trim();
      const payload = {
        patientId,
        appointmentId,
        motivoConsulta: motivo.trim() || undefined,
        subjetivo: subjetivo.trim() || undefined,
        objetivo: objetivo.trim() || undefined,
        evaluacion: evaluacion.trim() || undefined,
        plan: plan.trim() || undefined,
        constantes: Object.keys(constantes).length > 0 ? constantes : undefined,
      };
      const esNueva = consultaId === null;
      const res = await fetch(esNueva ? "/api/consultas" : `/api/consultas/${consultaId}`, {
        method: esNueva ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(esNueva ? payload : { ...payload, patientId: undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo guardar la consulta: ${j.error ?? "error"}`);
        return;
      }
      if (esNueva && j.id) {
        setConsultaId(j.id);
      }
      toast.success(esNueva ? "Consulta creada." : "Consulta actualizada.");
      router.refresh();
    });
  }

  function agregarDiagnostico(codigo: string, descripcion: string) {
    if (!consultaId) {
      toast.error("Guarda la consulta antes de agregar diagnósticos.");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/consultas/${consultaId}/diagnosticos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo agregar el diagnóstico: ${j.error ?? "error"}`);
        return;
      }
      setDiagnosticos((prev) => [...prev, { codigo, descripcion, esPrincipal: false, ocultoPortal: false }]);
      toast.success("Diagnóstico agregado.");
    });
  }

  function toggleOcultoPortal(codigo: string, oculto: boolean) {
    if (!consultaId) return;
    start(async () => {
      const res = await fetch(
        `/api/consultas/${consultaId}/diagnosticos/${encodeURIComponent(codigo)}/portal`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ocultoPortal: oculto }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo actualizar la visibilidad: ${j.error ?? "error"}`);
        return;
      }
      setDiagnosticos((prev) =>
        prev.map((d) => (d.codigo === codigo ? { ...d, ocultoPortal: oculto } : d)),
      );
      toast.success(oculto ? "Diagnóstico oculto en el portal." : "Diagnóstico visible en el portal.");
    });
  }

  function marcarPrincipal(codigo: string) {
    if (!consultaId) return;
    start(async () => {
      const res = await fetch(`/api/consultas/${consultaId}/diagnosticos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, esPrincipal: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) {
        toast.error(`No se pudo marcar como principal: ${j.error ?? "error"}`);
        return;
      }
      setDiagnosticos((prev) =>
        prev.map((d) => ({ ...d, esPrincipal: d.codigo === codigo })),
      );
      toast.success("Diagnóstico marcado como principal.");
    });
  }

  function quitarDiagnostico(codigo: string) {
    if (!consultaId) return;
    start(async () => {
      const res = await fetch(
        `/api/consultas/${consultaId}/diagnosticos/${encodeURIComponent(codigo)}`,
        { method: "DELETE" },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo quitar el diagnóstico: ${j.error ?? "error"}`);
        return;
      }
      setDiagnosticos((prev) => prev.filter((d) => d.codigo !== codigo));
      toast.success("Diagnóstico quitado.");
    });
  }

  function actualizarFila(i: number, campo: keyof FilaReceta, valor: string) {
    setFilasReceta((prev) => prev.map((f, idx) => (idx === i ? { ...f, [campo]: valor } : f)));
  }

  function guardarReceta() {
    if (!consultaId) {
      toast.error("Guarda la consulta antes de indicar recetas.");
      return;
    }
    const validas = filasReceta.filter((f) => f.medicamento.trim().length >= 2);
    if (validas.length === 0) {
      toast.error("Indica al menos un medicamento (mínimo 2 caracteres).");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/consultas/${consultaId}/recetas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          validas.map((f) => ({
            medicamento: f.medicamento.trim(),
            dosis: f.dosis.trim() || undefined,
            frecuencia: f.frecuencia.trim() || undefined,
            duracionDias: f.duracion ? Number(f.duracion) : undefined,
          })),
        ),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo guardar la receta: ${j.error ?? "error"}`);
        return;
      }
      setRecetas((prev) => [
        ...prev,
        ...validas.map((f) => ({
          id: `nueva-${f.medicamento}`,
          medicamento: f.medicamento.trim(),
          dosis: f.dosis.trim() || null,
          frecuencia: f.frecuencia.trim() || null,
          duracionDias: f.duracion ? Number(f.duracion) : null,
          indicaciones: null,
        })),
      ]);
      setFilasReceta([{ medicamento: "", dosis: "", frecuencia: "", duracion: "" }]);
      toast.success("Receta guardada.");
    });
  }

  function agregarOrden() {
    const nombre = ordenNombre.trim();
    if (nombre.length < 3) {
      toast.error("El nombre de la orden debe tener al menos 3 caracteres.");
      return;
    }
    start(async () => {
      const res = await fetch("/api/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          appointmentId,
          consultationId: consultaId ?? undefined,
          tipo: ordenTipo,
          nombre,
          indicacion: ordenIndicacion.trim() || undefined,
          prioridad: Number(ordenPrioridad) || 0,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo crear la orden: ${j.error ?? "error"}`);
        return;
      }
      setOrdenes((prev) => [
        {
          id: j.id,
          tipo: ordenTipo,
          nombre,
          indicacion: ordenIndicacion.trim() || null,
          estado: j.estado ?? "ordenada",
          prioridad: Number(ordenPrioridad) || 0,
        },
        ...prev,
      ]);
      setOrdenNombre("");
      setOrdenIndicacion("");
      setOrdenPrioridad("0");
      toast.success("Orden creada.");
      router.refresh();
    });
  }

  function publicarConsulta() {
    if (!consultaId) {
      toast.error("Guarda la consulta antes de publicarla.");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/consultas/${consultaId}/publicar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "publicar", publicarNota }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo publicar: ${j.error ?? "error"}`);
        return;
      }
      setPublicadoAt(new Date().toISOString());
      toast.success("Consulta publicada en el portal del paciente.");
      router.refresh();
    });
  }

  function despublicarConsulta() {
    if (!consultaId) return;
    const motivo = window.prompt("Motivo para retirar la consulta del portal:");
    if (!motivo || !motivo.trim()) return;
    start(async () => {
      const res = await fetch(`/api/consultas/${consultaId}/publicar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "despublicar", motivo: motivo.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo retirar: ${j.error ?? "error"}`);
        return;
      }
      setPublicadoAt(null);
      toast.success("Consulta retirada del portal.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="p-5 pb-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Stethoscope className="size-4 text-primary" />
            Consulta (SOAP)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          <div className="space-y-1.5">
            <Label>Motivo de consulta</Label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="¿Por qué viene el paciente?"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Subjetivo</Label>
              <Textarea value={subjetivo} onChange={(e) => setSubjetivo(e.target.value)} rows={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Objetivo</Label>
              <Textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} rows={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Evaluación</Label>
              <Textarea value={evaluacion} onChange={(e) => setEvaluacion(e.target.value)} rows={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Textarea value={plan} onChange={(e) => setPlan(e.target.value)} rows={4} />
            </div>
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Activity className="size-3.5" />
              Constantes vitales
            </p>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Peso (kg)</Label>
                <Input value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="70.5" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Temperatura (°C)</Label>
                <Input value={temperatura} onChange={(e) => setTemperatura(e.target.value)} placeholder="36.5" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Presión arterial</Label>
                <Input value={pa} onChange={(e) => setPa(e.target.value)} placeholder="120/80" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Frec. cardíaca (lpm)</Label>
                <Input value={fc} onChange={(e) => setFc(e.target.value)} placeholder="72" />
              </div>
            </div>
          </div>
          <div className="pt-1">
            <Button type="submit" onClick={guardarConsulta} disabled={guardando}>
              <Save className="size-4" />
              {consultaId ? "Actualizar consulta" : "Guardar consulta"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-5 pb-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <ClipboardList className="size-4 text-primary" />
            Portal del paciente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          {!consultaId ? (
            <p className="text-sm text-muted-foreground">
              Guarda la consulta para poder publicarla en el portal del paciente.
            </p>
          ) : publicadoAt ? (
            <>
              <p className="text-sm text-foreground">
                Esta consulta está <span className="font-semibold">visible en el portal</span> del
                paciente (motivo, plan y diagnósticos no ocultos).
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={guardando} onClick={despublicarConsulta}>
                  Retirar del portal
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Al publicar, el paciente verá el motivo, el plan y los diagnósticos (puedes ocultar
                diagnósticos sensibles). La nota SOAP completa solo se muestra si lo activas.
              </p>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={publicarNota}
                  onChange={(e) => setPublicarNota(e.target.checked)}
                  className="size-4 rounded border-input"
                />
                Mostrar también la nota SOAP completa
              </label>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" disabled={guardando} onClick={publicarConsulta}>
                  Publicar en el portal
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-5 pb-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <ClipboardList className="size-4 text-primary" />
            Diagnósticos (CIE-10)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          {!consultaId ? (
            <p className="text-sm text-muted-foreground">
              Guarda la consulta para poder agregar diagnósticos.
            </p>
          ) : (
            <>
              <Cie10Autocomplete onSelect={agregarDiagnostico} />
              {diagnosticos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin diagnósticos registrados.</p>
              ) : (
                <ul className="divide-y">
                  {diagnosticos.map((d) => (
                    <li key={d.codigo} className="flex items-center gap-2 py-2.5">
                      <span className="shrink-0 font-mono text-xs font-semibold text-primary">{d.codigo}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{d.descripcion ?? d.codigo}</span>
                      {d.esPrincipal ? (
                        <Badge variant="teal">Principal</Badge>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={guardando}
                          onClick={() => marcarPrincipal(d.codigo)}
                        >
                          Marcar principal
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 px-2 text-xs",
                          d.ocultoPortal ? "text-amber-600" : "text-muted-foreground",
                        )}
                        disabled={guardando}
                        onClick={() => toggleOcultoPortal(d.codigo, !d.ocultoPortal)}
                        title={
                          d.ocultoPortal
                            ? "Oculto en el portal del paciente. Clic para mostrar."
                            : "Visible en el portal del paciente. Clic para ocultar."
                        }
                      >
                        {d.ocultoPortal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        {d.ocultoPortal ? "Oculto" : "Visible"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground"
                        disabled={guardando}
                        onClick={() => quitarDiagnostico(d.codigo)}
                      >
                        <Trash2 className="size-3.5" />
                        Quitar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-5 pb-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Plus className="size-4 text-primary" />
            Receta médica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          {recetas.length > 0 ? (
            <ul className="divide-y">
              {recetas.map((r, i) => (
                <li key={`${r.id}-${i}`} className="py-2.5">
                  <p className="text-sm font-medium">{r.medicamento}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.dosis ?? "Sin dosis"} · {r.frecuencia ?? "sin frecuencia"}
                    {r.duracionDias ? ` · ${r.duracionDias} días` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          {!consultaId ? (
            <p className="text-sm text-muted-foreground">
              Guarda la consulta para poder indicar medicamentos.
            </p>
          ) : (
            <div className="space-y-3">
              {filasReceta.map((f, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_80px]">
                  <Input
                    value={f.medicamento}
                    onChange={(e) => actualizarFila(i, "medicamento", e.target.value)}
                    placeholder="Medicamento"
                  />
                  <Input
                    value={f.dosis}
                    onChange={(e) => actualizarFila(i, "dosis", e.target.value)}
                    placeholder="Dosis"
                  />
                  <Input
                    value={f.frecuencia}
                    onChange={(e) => actualizarFila(i, "frecuencia", e.target.value)}
                    placeholder="Frecuencia"
                  />
                  <Input
                    type="number"
                    min="1"
                    value={f.duracion}
                    onChange={(e) => actualizarFila(i, "duracion", e.target.value)}
                    placeholder="Días"
                  />
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    filasReceta.length < 10 &&
                    setFilasReceta((prev) => [
                      ...prev,
                      { medicamento: "", dosis: "", frecuencia: "", duracion: "" },
                    ])
                  }
                >
                  <Plus className="size-3.5" />
                  Añadir línea
                </Button>
                <Button type="button" size="sm" disabled={guardando} onClick={guardarReceta}>
                  <Save className="size-3.5" />
                  Guardar receta
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-5 pb-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FlaskConical className="size-4 text-primary" />
            Órdenes de laboratorio e imagen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          {puedeCrearOrdenes ? (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
              <div className="grid gap-2 sm:grid-cols-[110px_1fr_1fr_90px]">
                <Select value={ordenTipo} onChange={(e) => setOrdenTipo(e.target.value)}>
                  <option value="laboratorio">Laboratorio</option>
                  <option value="imagen">Imagen</option>
                </Select>
                <Input
                  value={ordenNombre}
                  onChange={(e) => setOrdenNombre(e.target.value)}
                  placeholder="Ej. Hemograma completo"
                />
                <Input
                  value={ordenIndicacion}
                  onChange={(e) => setOrdenIndicacion(e.target.value)}
                  placeholder="Indicación (opcional)"
                />
                <Select value={ordenPrioridad} onChange={(e) => setOrdenPrioridad(e.target.value)}>
                  <option value="0">P0</option>
                  <option value="1">P1</option>
                  <option value="2">P2</option>
                  <option value="3">P3</option>
                </Select>
              </div>
              <Button type="button" size="sm" disabled={guardando} onClick={agregarOrden}>
                <Plus className="size-3.5" />
                Añadir orden
              </Button>
            </div>
          ) : null}

          {ordenes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin órdenes para esta cita.</p>
          ) : (
            <ul className="divide-y">
              {ordenes.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-2.5">
                  <Badge variant={o.tipo === "laboratorio" ? "blue" : "violet"}>
                    {o.tipo === "laboratorio" ? "Laboratorio" : "Imagen"}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{o.nombre}</p>
                    {o.indicacion ? (
                      <p className="truncate text-xs text-muted-foreground">{o.indicacion}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {ESTADO_ORDEN[o.estado] ?? o.estado}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
