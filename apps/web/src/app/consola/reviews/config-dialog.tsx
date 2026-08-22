"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConfigDialog({
  googlePlaceId,
  googleReviewUrl,
}: {
  googlePlaceId: string | null;
  googleReviewUrl: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [placeId, setPlaceId] = useState(googlePlaceId ?? "");
  const [reviewUrl, setReviewUrl] = useState(googleReviewUrl ?? "");

  async function guardar() {
    setPending(true);
    try {
      const res = await fetch("/api/config/reviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googlePlaceId: placeId || null,
          googleReviewUrl: reviewUrl || null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        toast.error(
          j.error === "enlace_invalido"
            ? "El enlace debe empezar con https://"
            : `No se pudo guardar: ${j.error ?? "error"}`,
        );
        return;
      }
      toast.success("Configuración de reseñas guardada.");
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Settings2 className="size-4" />
        Configurar enlace
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Enlace de reseñas de Google"
        description="Al terminar la visita, recepción envía al paciente un correo con el botón para dejar su reseña."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="res-placeid">Place ID de Google (opcional)</Label>
            <Input
              id="res-placeid"
              placeholder="ChIJK1234567890..."
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-url">URL directa de reseña (opcional)</Label>
            <Input
              id="res-url"
              placeholder="https://g.page/r/..."
              value={reviewUrl}
              onChange={(e) => setReviewUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Si solo pones el Place ID, generamos la URL de reseña automáticamente.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
