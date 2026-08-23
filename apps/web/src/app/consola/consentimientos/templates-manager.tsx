"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PenLine, Plus, Trash2 } from "lucide-react";

export type TemplateConsentimiento = {
  id: string;
  nombre: string;
  tratamiento: string | null;
  contenido: string;
  activo: boolean;
};

export function TemplatesManager({ templates }: { templates: TemplateConsentimiento[] }) {
  const [lista, setLista] = useState(templates);
  const [editando, setEditando] = useState<TemplateConsentimiento | "nuevo" | null>(null);
  const [nombre, setNombre] = useState("");
  const [tratamiento, setTratamiento] = useState("");
  const [contenido, setContenido] = useState("");
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  function abrirNuevo() {
    setEditando("nuevo");
    setNombre("");
    setTratamiento("");
    setContenido("");
  }

  function abrirEdicion(t: TemplateConsentimiento) {
    setEditando(t);
    setNombre(t.nombre);
    setTratamiento(t.tratamiento ?? "");
    setContenido(t.contenido);
  }

  async function guardar() {
    setCargando(true);
    try {
      const id = editando === "nuevo" ? null : editando?.id;
      const r = await fetch(id ? `/api/consentimientos-v2/templates/${id}` : "/api/consentimientos-v2/templates", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, tratamiento: tratamiento || null, contenido }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error === "nombre_ya_existe" ? "Ya existe una plantilla con ese nombre" : "No se pudo guardar");
        return;
      }
      toast.success("Plantilla guardada");
      setEditando(null);
      router.refresh();
    } finally {
      setCargando(false);
    }
  }

  async function eliminar(t: TemplateConsentimiento) {
    if (!window.confirm(`¿Eliminar la plantilla "${t.nombre}"?`)) return;
    const r = await fetch(`/api/consentimientos-v2/templates/${t.id}`, { method: "DELETE" });
    if (!r.ok) {
      toast.error("No se pudo eliminar (¿tiene firmas asociadas?)");
      return;
    }
    toast.success("Plantilla eliminada");
    setLista((prev) => prev.filter((x) => x.id !== t.id));
  }

  async function toggleActivo(t: TemplateConsentimiento) {
    const r = await fetch(`/api/consentimientos-v2/templates/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !t.activo }),
    });
    if (!r.ok) return;
    setLista((prev) => prev.map((x) => (x.id === t.id ? { ...x, activo: !t.activo } : x)));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={abrirNuevo}>
          <Plus className="size-3.5" /> Nueva plantilla
        </Button>
      </div>

      {editando ? (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">
            {editando === "nuevo" ? "Nueva plantilla" : `Editar: ${editando.nombre}`}
          </p>
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tratamiento (opcional)</Label>
            <Input value={tratamiento} onChange={(e) => setTratamiento(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Contenido del consentimiento</Label>
            <Textarea rows={8} value={contenido} onChange={(e) => setContenido(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={cargando || !nombre.trim() || !contenido.trim()} onClick={guardar}>
              Guardar
            </Button>
          </div>
        </div>
      ) : null}

      {lista.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Sin plantillas todavía. Crea la primera para poder firmar consentimientos.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {lista.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {t.nombre}
                  {!t.activo ? <Badge variant="gray">Inactiva</Badge> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.tratamiento ?? "Sin tratamiento asociado"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={() => toggleActivo(t)}>
                  {t.activo ? "Desactivar" : "Activar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => abrirEdicion(t)}>
                  <PenLine className="size-3.5" /> Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => eliminar(t)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
