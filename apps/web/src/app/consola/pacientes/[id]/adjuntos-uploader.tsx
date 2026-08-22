"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const MAX_MB = 10;
const TIPO_OPTS = [
  { value: "otro", label: "Documento / otro" },
  { value: "rx", label: "Radiografía" },
];

export function AdjuntosUploader({ patientId }: { patientId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [tipo, setTipo] = useState("otro");
  const [nota, setNota] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecciona un archivo.");
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
      fd.set("tipo", tipo);
      if (nota.trim()) fd.set("nota", nota.trim());
      const res = await fetch(`/api/pacientes/${patientId}/adjuntos`, {
        method: "POST",
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          j.error === "formato_no_permitido"
            ? "Formato no permitido (solo JPG, PNG, WEBP o PDF)."
            : `No se pudo subir el archivo: ${j.error ?? "error"}`,
        );
        return;
      }
      toast.success("Archivo subido.");
      if (fileRef.current) fileRef.current.value = "";
      setNota("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        id="adjunto-archivo"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
      >
        <Paperclip className="size-4" />
        Elegir archivo
      </Button>
      <Select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-auto">
        {TIPO_OPTS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <Input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Nota (opcional)"
        className="min-w-40 max-w-52"
        maxLength={200}
      />
      <Button type="submit" size="sm" disabled={pending}>
        <Upload className="size-4" />
        {pending ? "Subiendo…" : "Subir"}
      </Button>
    </form>
  );
}
