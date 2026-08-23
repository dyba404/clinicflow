"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSignature, Loader2, PenLine } from "lucide-react";
import { PadDeFirma } from "@/components/firma/pad-de-firma";

type Consentimiento = {
  id: string;
  plantillaNombre: string | null;
  tratamiento: string | null;
  firmanteNombre: string;
  firmanteRol: string;
  signedAt: string;
};

type Template = {
  id: string;
  nombre: string;
  tratamiento: string | null;
  contenido: string;
  activo: boolean;
};

export function ConsentV2Card({ patientId, canEdit }: { patientId: string; canEdit: boolean }) {
  const [lista, setLista] = useState<Consentimiento[] | null>(null);
  const [firmando, setFirmando] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<"paciente" | "tutor">("paciente");
  const [firma, setFirma] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    fetch(`/api/pacientes/${patientId}/consentimientos-v2`)
      .then((r) => (r.ok ? r.json() : { consentimientos: [] }))
      .then((j) => {
        if (activo) setLista((j.consentimientos ?? []) as Consentimiento[]);
      })
      .catch(() => {
        if (activo) setLista([]);
      });
    return () => {
      activo = false;
    };
  }, [patientId]);

  async function empezarFirma() {
    setFirmando(true);
    try {
      const r = await fetch("/api/consentimientos-v2/templates");
      if (r.ok) {
        const j = (await r.json()) as { templates: Template[] };
        const activos = (j.templates ?? []).filter((t) => t.activo);
        setTemplates(activos);
        if (activos.length > 0 && activos[0]) setTemplateId(activos[0].id);
      }
    } catch {
      toast.error("No se pudieron cargar las plantillas");
    }
  }

  async function guardar() {
    if (!templateId || !nombre.trim() || !firma) {
      toast.error("Plantilla, nombre y firma son obligatorios");
      return;
    }
    setGuardando(true);
    try {
      const r = await fetch(`/api/pacientes/${patientId}/consentimientos-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          firmanteNombre: nombre.trim(),
          firmanteRol: rol,
          signatureData: firma,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error(`No se pudo firmar: ${j.error ?? "error"}`);
        return;
      }
      toast.success("Consentimiento firmado");
      setFirmando(false);
      setFirma(null);
      setNombre("");
      setLista((prev) => [
        {
          id: (r.status === 201 ? "temp" : "") + Date.now(),
          plantillaNombre: templates.find((t) => t.id === templateId)?.nombre ?? null,
          tratamiento: null,
          firmanteNombre: nombre.trim(),
          firmanteRol: rol,
          signedAt: new Date().toISOString(),
        },
        ...(prev ?? []),
      ]);
    } finally {
      setGuardando(false);
    }
  }

  const templateSel = templates.find((t) => t.id === templateId);

  return (
    <div className="space-y-3">
      {lista === null ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Cargando consentimientos…
        </p>
      ) : lista.length === 0 && !firmando ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileSignature className="size-4" /> Sin consentimientos firmados todavía.
        </p>
      ) : null}

      {lista && lista.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {lista.map((c, i) => (
            <li key={c.id ?? i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-medium">{c.plantillaNombre ?? "Consentimiento"}</span>
                <span className="block text-xs text-muted-foreground">
                  Firmado por {c.firmanteNombre} ({c.firmanteRol}) ·{" "}
                  {new Date(c.signedAt).toLocaleDateString("es-PE", { dateStyle: "medium" })}
                </span>
              </span>
              {c.tratamiento ? (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {c.tratamiento}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!firmando && canEdit ? (
        <Button size="sm" variant="outline" onClick={empezarFirma}>
          <PenLine className="size-3.5" /> Firmar consentimiento
        </Button>
      ) : null}

      {firmando ? (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-1.5">
            <Label>Plantilla</Label>
            <div className="space-y-1">
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No hay plantillas activas. Créalas en /consola/consentimientos.
                </p>
              ) : (
                templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(t.id)}
                    className={`block w-full rounded-md border px-3 py-2 text-left text-xs ${
                      templateId === t.id ? "border-primary bg-accent" : ""
                    }`}
                  >
                    <span className="font-medium">{t.nombre}</span>
                    <span className="block truncate text-muted-foreground">
                      {t.contenido.slice(0, 100)}…
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
          {templateSel ? (
            <div className="max-h-40 overflow-y-auto rounded-md bg-muted/40 p-3 text-xs whitespace-pre-wrap">
              {templateSel.contenido}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre del firmante</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Firma como</Label>
              <div className="flex gap-2">
                {(["paciente", "tutor"] as const).map((r) => (
                  <Button
                    key={r}
                    type="button"
                    size="sm"
                    variant={rol === r ? "default" : "outline"}
                    onClick={() => setRol(r)}
                  >
                    {r === "paciente" ? "Paciente" : "Tutor"}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <PadDeFirma onChange={setFirma} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setFirmando(false)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={guardando || !firma || !nombre.trim()} onClick={guardar}>
              {guardando ? <Loader2 className="size-3.5 animate-spin" /> : "Firmar"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
