"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BedDouble, CheckCircle2, LogOut, Plus, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface AdmisionDetalleProps {
  id: string;
  nombrePaciente: string;
  tipo: string;
  motivo: string;
  estado: string;
  admitidaEl: string;
  dischargedAt: string | null;
  altaTipo: string | null;
  epicrisis: string | null;
  doctorNombre: string | null;
}

interface CamaLibre {
  id: string;
  nombre: string;
  area: string | null;
  tipo: string;
}

interface Evolucion {
  id: string;
  fecha: string;
  nota: string;
  nombreDoctor: string | null;
}

const TIPO_LABEL: Record<string, string> = {
  emergencia: "Emergencia",
  observacion: "Observación",
  internamiento: "Internamiento",
};

const ESTADO_LABEL: Record<string, string> = {
  activa: "Activa",
  egresada: "Egresada",
  abandono: "Abandono",
};

const ESTADO_BADGE: Record<string, "green" | "gray" | "red"> = {
  activa: "green",
  egresada: "gray",
  abandono: "red",
};

const ALTA_LABEL: Record<string, string> = {
  medica: "Alta médica",
  voluntaria: "Alta voluntaria",
};

const ERROR_MSG: Record<string, string> = {
  admision_no_encontrada: "La admisión ya no existe.",
  admision_no_activa: "La admisión ya no está activa.",
  cama_no_encontrada: "La cama ya no existe en este equipo.",
  cama_no_disponible: "La cama ya no está disponible.",
  cama_no_asignada: "La admisión no tiene cama asignada.",
  motivo_invalido: "El motivo debe tener al menos 3 caracteres.",
  alta_tipo_invalido: "Selecciona el tipo de alta.",
  epicrisis_requerida: "La epicrisis debe tener al menos 20 caracteres.",
  nota_invalida: "La nota debe tener al menos 10 caracteres.",
  sin_sesion: "Tu sesión expiró. Vuelve a iniciar sesión.",
  sin_permiso: "No tienes permiso para esta acción.",
};

function parseError(res: { ok: boolean }, j: { error?: string }): string | null {
  if (res.ok) return null;
  return ERROR_MSG[j.error ?? ""] ?? `No se pudo completar la acción: ${j.error ?? "error"}`;
}

export function AdmisionDetalle({
  admision,
  cama,
  camasLibres,
  evoluciones,
}: {
  admision: AdmisionDetalleProps;
  cama: { nombre: string; area: string | null; tipo: string } | null;
  camasLibres: CamaLibre[];
  evoluciones: Evolucion[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialogCama, setDialogCama] = useState(false);
  const [camaId, setCamaId] = useState("");
  const [motivoEdicion, setMotivoEdicion] = useState(admision.motivo);
  const [editandoMotivo, setEditandoMotivo] = useState(false);
  const [nota, setNota] = useState("");
  const [altaTipo, setAltaTipo] = useState("medica");
  const [epicrisis, setEpicrisis] = useState("");

  const activa = admision.estado === "activa";

  function patch(body: Record<string, unknown>, exito: string) {
    start(async () => {
      const res = await fetch(`/api/hospitalizacion/${admision.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      const error = parseError(res, j);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(exito);
      router.refresh();
    });
  }

  function guardarMotivo() {
    const limpio = motivoEdicion.trim();
    if (limpio.length < 3 || limpio === admision.motivo) {
      setEditandoMotivo(false);
      return;
    }
    start(async () => {
      const res = await fetch(`/api/hospitalizacion/${admision.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admision: { motivo: limpio } }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      const error = parseError(res, j);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Motivo actualizado.");
      setEditandoMotivo(false);
      router.refresh();
    });
  }

  function asignarCama() {
    if (!camaId) {
      toast.error("Selecciona una cama.");
      return;
    }
    patch({ camaId }, "Cama asignada.");
    setDialogCama(false);
    setCamaId("");
  }

  function liberarCama() {
    if (!window.confirm(`¿Liberar la cama ${cama?.nombre ?? ""}? La cama quedará en estado de limpieza.`)) {
      return;
    }
    patch({ accion: "liberar_cama" }, "Cama liberada y enviada a limpieza.");
  }

  function guardarEvolucion(e: FormEvent) {
    e.preventDefault();
    const limpio = nota.trim();
    if (limpio.length < 10) {
      toast.error("La nota debe tener al menos 10 caracteres.");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/hospitalizacion/${admision.id}/evoluciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota: limpio }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      const error = parseError(res, j);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Evolución guardada.");
      setNota("");
      router.refresh();
    });
  }

  function registrarAlta(e: FormEvent) {
    e.preventDefault();
    const limpia = epicrisis.trim();
    if (limpia.length < 20) {
      toast.error("La epicrisis debe tener al menos 20 caracteres.");
      return;
    }
    if (!window.confirm(`¿Registrar el alta ${altaTipo === "medica" ? "médica" : "voluntaria"} de ${admision.nombrePaciente}?`)) {
      return;
    }
    patch({ alta: { tipo: altaTipo, epicrisis: limpia } }, "Alta registrada.");
  }

  function registrarAbandono() {
    if (!window.confirm(`¿Marcar como abandono la admisión de ${admision.nombrePaciente}?`)) {
      return;
    }
    patch({ abandono: true }, "Admisión marcada como abandono.");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="p-5 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{admision.nombrePaciente}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="blue">{TIPO_LABEL[admision.tipo] ?? admision.tipo}</Badge>
              <Badge variant={ESTADO_BADGE[admision.estado] ?? "gray"}>
                {ESTADO_LABEL[admision.estado] ?? admision.estado}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Admitida el {admision.admitidaEl}
            {admision.doctorNombre ? ` · Recibida por ${admision.doctorNombre}` : ""}
            {admision.dischargedAt ? ` · Egresada el ${admision.dischargedAt}` : ""}
          </p>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <Label htmlFor="adm-motivo">Motivo del ingreso</Label>
          {activa && editandoMotivo ? (
            <div className="mt-2 space-y-2">
              <Textarea
                id="adm-motivo"
                rows={2}
                value={motivoEdicion}
                onChange={(e) => setMotivoEdicion(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setMotivoEdicion(admision.motivo);
                    setEditandoMotivo(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="button" size="sm" disabled={pending} onClick={guardarMotivo}>
                  Guardar motivo
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-start justify-between gap-3">
              <p className="text-sm">{admision.motivo}</p>
              {activa ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  disabled={pending}
                  onClick={() => setEditandoMotivo(true)}
                >
                  Editar
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-5 pb-4">
            <CardTitle className="flex items-center gap-2">
              <BedDouble className="size-4 text-primary" />
              Cama actual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            {cama ? (
              <div className="rounded-lg border px-3 py-2">
                <p className="text-sm font-medium">{cama.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {cama.area ? `${cama.area} · ` : ""}
                  {cama.tipo === "cama" ? "Cama" : cama.tipo === "sillon" ? "Sillón" : "Aislamiento"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin cama asignada.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || !activa}
                onClick={() => setDialogCama(true)}
              >
                {cama ? "Asignar / transferir" : "Asignar cama"}
              </Button>
              {cama ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending || !activa}
                  className="text-muted-foreground"
                  onClick={liberarCama}
                >
                  <LogOut className="size-3.5" />
                  Liberar cama
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5 pb-4">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              Alta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            {activa ? (
              <form onSubmit={registrarAlta} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="alta-tipo">Tipo de alta</Label>
                  <Select
                    id="alta-tipo"
                    value={altaTipo}
                    onChange={(e) => setAltaTipo(e.target.value)}
                  >
                    <option value="medica">Médica</option>
                    <option value="voluntaria">Voluntaria</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="alta-epicrisis">Epicrisis (mínimo 20 caracteres)</Label>
                  <Textarea
                    id="alta-epicrisis"
                    rows={4}
                    value={epicrisis}
                    onChange={(e) => setEpicrisis(e.target.value)}
                    placeholder="Resumen clínico de la internación…"
                  />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    disabled={pending}
                    onClick={registrarAbandono}
                  >
                    Marcar abandono
                  </Button>
                  <Button type="submit" size="sm" disabled={pending}>
                    Registrar alta
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {admision.estado === "egresada"
                    ? `Egresada el ${admision.dischargedAt ?? "—"} · ${ALTA_LABEL[admision.altaTipo ?? ""] ?? admision.altaTipo ?? ""}`
                    : `Marcada como abandono el ${admision.dischargedAt ?? "—"}.`}
                </p>
                {admision.epicrisis ? (
                  <div className="rounded-lg border bg-muted/40 px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">Epicrisis</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{admision.epicrisis}</p>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-5 pb-4">
          <CardTitle className="flex items-center gap-2">
            <UserRound className="size-4 text-primary" />
            Evoluciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          <form onSubmit={guardarEvolucion} className="space-y-2">
            <Textarea
              rows={3}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Nueva evolución del paciente…"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={pending || nota.trim().length === 0}>
                <Plus className="size-3.5" />
                Guardar evolución
              </Button>
            </div>
          </form>

          {evoluciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay evoluciones registradas.</p>
          ) : (
            <ul className="space-y-3">
              {evoluciones.map((e) => (
                <li key={e.id} className="rounded-lg border px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{e.fecha}</span>
                    <span>{e.nombreDoctor ?? "Sin médico asignado"}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{e.nota}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogCama}
        onClose={() => {
          setDialogCama(false);
          setCamaId("");
        }}
        title={cama ? "Asignar / transferir cama" : "Asignar cama"}
        icon={<BedDouble className="size-4 text-primary" />}
        description="Solo se muestran camas en estado libre."
      >
        <div className="space-y-4">
          {camasLibres.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay camas libres en este momento.</p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="cama-select">Cama</Label>
              <Select id="cama-select" value={camaId} onChange={(e) => setCamaId(e.target.value)}>
                <option value="">Selecciona una cama…</option>
                {camasLibres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                    {c.area ? ` · ${c.area}` : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialogCama(false);
                setCamaId("");
              }}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={pending || camasLibres.length === 0} onClick={asignarCama}>
              {cama ? "Transferir" : "Asignar"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
