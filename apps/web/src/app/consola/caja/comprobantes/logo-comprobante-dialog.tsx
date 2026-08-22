"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";

export function LogoComprobanteDialog({ hayLogo: propHayLogo }: { hayLogo: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [logo, setLogo] = useState("");
  const [loading, setLoading] = useState(false);
  const [hayLogo, setHayLogo] = useState(propHayLogo);
  const [cache, setCache] = useState(0);

  const src = `/api/fiscal/logo${cache ? `?cache=${cache}` : ""}`;

  async function subir(e: FormEvent) {
    e.preventDefault();
    if (!logo) {
      toast.error("Selecciona una imagen PNG");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/fiscal/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoBase64: logo.split(",")[1] ?? logo }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        enviadoSidecar?: boolean;
      };
      if (!res.ok) {
        const claves: Record<string, string> = {
          logo_debe_ser_png: "El logo debe ser una imagen PNG",
          logo_muy_grande: "El logo excede 2 MB",
          logo_requerido: "Selecciona una imagen",
        };
        toast.error(j.error ? claves[j.error] ?? j.error : "No se pudo guardar el logo");
        return;
      }
      setHayLogo(true);
      setCache(Date.now());
      setLogo("");
      toast.success(
        j.enviadoSidecar
          ? "Logo guardado y sincronizado con el sidecar Greenter."
          : "Logo guardado para los PDF de comprobantes.",
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function quitar() {
    setLoading(true);
    try {
      const res = await fetch("/api/fiscal/logo", { method: "DELETE" });
      if (res.ok) {
        setHayLogo(false);
        setCache(0);
        toast.success("Logo eliminado");
        router.refresh();
      } else {
        toast.error("No se pudo eliminar el logo");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ImageIcon className="size-3.5" />
        Logo de comprobantes
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Logo del comprobante"
        icon={<ImageIcon className="size-4 text-primary" />}
        description="El logo aparece en la cabecera del PDF de cada comprobante y se sincroniza con el sidecar Greenter si está configurado."
      >
        <div className="space-y-3">
          {hayLogo ? (
            <div className="flex items-center gap-3 rounded-lg border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt="Logo de la clínica"
                className="max-h-16 max-w-32 object-contain"
              />
              <span className="text-xs text-muted-foreground">
                Este es el logo actual en los comprobantes.
              </span>
            </div>
          ) : (
            <p className="rounded-lg border px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              Aún no hay logo configurado (o recarga esta página para verlo). Sube un PNG
              (máximo 2 MB) para incluirlo en tus comprobantes electrónicos.
            </p>
          )}
          <form onSubmit={subir} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="logo-archivo">
                Imagen PNG
              </label>
              <Input
                id="logo-archivo"
                type="file"
                accept="image/png"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.type !== "image/png") {
                    toast.error("El logo debe ser una imagen PNG");
                    return;
                  }
                  if (f.size > 2 * 1024 * 1024) {
                    toast.error("El logo excede 2 MB");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () =>
                    setLogo(typeof reader.result === "string" ? reader.result : "");
                  reader.readAsDataURL(f);
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              {hayLogo ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => void quitar()}
                  disabled={loading}
                >
                  <Trash2 className="size-3.5" />
                  Quitar
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={loading || !logo}>
                  {loading && !logo ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  Guardar logo
                </Button>
              </div>
            </div>
          </form>
        </div>
      </Dialog>
    </>
  );
}
