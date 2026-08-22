"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type FotoGrupo = {
  tratamiento: string;
  fotos: Array<{
    id: string;
    nombre: string;
    fotoTipo: string | null;
    fotoOrden: number | null;
    mime: string;
    createdAt: string | Date;
  }>;
};

const MAX_MB = 10;
const COLUMNAS = [
  { key: "antes", label: "Antes" },
  { key: "progreso", label: "Progreso" },
  { key: "despues", label: "Después" },
] as const;

type Foto = FotoGrupo["fotos"][number];

function claveGrupo(g: FotoGrupo): string {
  return g.tratamiento || "General";
}

export function FotosCard({
  patientId,
  grupos,
  canEdit,
}: {
  patientId: string;
  grupos: FotoGrupo[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [tratamiento, setTratamiento] = useState("");
  const [fotoTipo, setFotoTipo] = useState("antes");
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [ordenes, setOrdenes] = useState<Record<string, number>>({});

  function ordenFoto(f: Foto): number {
    return ordenes[f.id] ?? f.fotoOrden ?? 0;
  }

  function ubicarFoto(id: string): { grupo: string; tipo: string | null } | null {
    for (const g of grupos) {
      for (const f of g.fotos) {
        if (f.id === id) return { grupo: claveGrupo(g), tipo: f.fotoTipo };
      }
    }
    return null;
  }

  function guardarOrden(cambios: Array<{ id: string; fotoOrden: number }>) {
    void Promise.all(
      cambios.map(async (c) => {
        const res = await fetch(`/api/adjuntos/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fotoOrden: c.fotoOrden }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "error");
        }
        return res;
      }),
    )
      .then(() => {
        toast.success("Orden de las fotos actualizado.");
        router.refresh();
      })
      .catch(() => {
        toast.error("No se pudo guardar el nuevo orden de las fotos.");
        router.refresh();
      });
  }

  function reordenar(grupoKey: string, colKey: string, sobreId: string | null) {
    if (!canEdit || !arrastrando || arrastrando === sobreId) return;
    const origen = ubicarFoto(arrastrando);
    if (!origen || origen.grupo !== grupoKey || origen.tipo !== colKey) return;
    const grupo = grupos.find((g) => claveGrupo(g) === grupoKey);
    if (!grupo) return;
    const columna = grupo.fotos
      .filter((f) => f.fotoTipo === colKey)
      .sort((a, b) => ordenFoto(a) - ordenFoto(b));
    const ids = columna.map((f) => f.id);
    const desde = ids.indexOf(arrastrando);
    if (desde === -1) return;
    ids.splice(desde, 1);
    const hasta = sobreId === null ? ids.length : ids.indexOf(sobreId);
    if (sobreId !== null && hasta === -1) return;
    ids.splice(hasta, 0, arrastrando);
    const nuevos: Record<string, number> = {};
    const cambios: Array<{ id: string; fotoOrden: number }> = [];
    ids.forEach((id, i) => {
      nuevos[id] = i + 1;
      const f = columna.find((x) => x.id === id)!;
      if ((f.fotoOrden ?? 0) !== i + 1) cambios.push({ id, fotoOrden: i + 1 });
    });
    setOrdenes((prev) => ({ ...prev, ...nuevos }));
    setArrastrando(null);
    if (cambios.length > 0) guardarOrden(cambios);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecciona una imagen.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes para las fotos.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`El archivo supera el máximo de ${MAX_MB} MB.`);
      return;
    }
    start(async () => {
      const fd = new FormData();
      fd.set("archivo", file);
      fd.set("patientId", patientId);
      fd.set("tipo", "otro");
      fd.set("fotoTipo", fotoTipo);
      if (tratamiento.trim()) fd.set("tratamiento", tratamiento.trim());
      const res = await fetch(`/api/pacientes/${patientId}/adjuntos`, {
        method: "POST",
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          j.error === "foto_solo_imagen"
            ? "Solo se permiten imágenes (JPG, PNG o WEBP) para las fotos."
            : `No se pudo subir la foto: ${j.error ?? "error"}`,
        );
        return;
      }
      toast.success("Foto subida.");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            id="foto-archivo"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="size-4" />
            Elegir foto
          </Button>
          <Select value={fotoTipo} onChange={(e) => setFotoTipo(e.target.value)} className="w-auto">
            <option value="antes">Antes</option>
            <option value="progreso">Progreso</option>
            <option value="despues">Después</option>
          </Select>
          <Input
            value={tratamiento}
            onChange={(e) => setTratamiento(e.target.value)}
            placeholder="Tratamiento (opcional)"
            className="min-w-40 max-w-52"
            maxLength={80}
          />
          <Button type="submit" size="sm" disabled={pending}>
            <Upload className="size-4" />
            {pending ? "Subiendo…" : "Subir"}
          </Button>
        </form>
      ) : null}

      {grupos.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          Sin fotos registradas todavía.
        </p>
      ) : (
        <div className="space-y-5">
          {grupos.map((grupo) => {
            const visibles = COLUMNAS.filter((c) =>
              grupo.fotos.some((f) => f.fotoTipo === c.key),
            );
            return (
              <div key={grupo.tratamiento || "General"}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {grupo.tratamiento || "General"}
                </p>
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: `repeat(${visibles.length || 1}, minmax(0, 1fr))` }}
                >
                  {visibles.map((col) => {
                    const fotos = grupo.fotos
                      .filter((f) => f.fotoTipo === col.key)
                      .sort((a, b) => ordenFoto(a) - ordenFoto(b));
                    return (
                      <div key={col.key} className="min-w-0">
                        <p className="mb-1 text-xs text-muted-foreground">{col.label}</p>
                        <div
                          className="grid grid-cols-2 gap-2"
                          onDragOver={(e) => {
                            if (canEdit && arrastrando) e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            reordenar(grupo.tratamiento || "General", col.key, null);
                          }}
                        >
                          {fotos.map((f) => (
                            <a
                              key={f.id}
                              href={`/api/adjuntos/${f.id}`}
                              target="_blank"
                              rel="noreferrer"
                              title={f.nombre}
                              draggable={canEdit || undefined}
                              onDragStart={(e) => {
                                if (!canEdit) {
                                  e.preventDefault();
                                  return;
                                }
                                setArrastrando(f.id);
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", f.id);
                              }}
                              onDragEnd={() => setArrastrando(null)}
                              onDragOver={(e) => {
                                if (!canEdit || !arrastrando || arrastrando === f.id) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                reordenar(grupo.tratamiento || "General", col.key, f.id);
                              }}
                              style={arrastrando === f.id ? { opacity: 0.4 } : undefined}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- el optimizador de next/image no puede acceder al endpoint autenticado /api/adjuntos */}
                              <img
                                src={`/api/adjuntos/${f.id}`}
                                alt={f.nombre}
                                loading="lazy"
                                draggable={false}
                                className="max-h-40 w-full cursor-grab rounded object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
