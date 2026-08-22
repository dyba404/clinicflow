"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eraser, PenLine, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConsentDialog({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [servicio, setServicio] = useState("");
  const [firmado, setFirmado] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1c1917";
    setFirmado(false);
  }, [open]);

  function coords(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start_(e: React.PointerEvent<HTMLCanvasElement>) {
    dibujando.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = coords(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
    setFirmado(true);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = coords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setFirmado(true);
  }

  function end() {
    dibujando.current = false;
  }

  function limpiarFirma() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFirmado(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!firmado) {
      toast.error("El paciente debe firmar antes de guardar.");
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    start(async () => {
      const res = await fetch(`/api/pacientes/${patientId}/consentimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firmaBase64Png: dataUrl,
          servicioNombre: servicio.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo guardar el consentimiento: ${j.error ?? "error"}`);
        return;
      }
      toast.success("Consentimiento firmado y guardado como PDF.");
      setOpen(false);
      setServicio("");
      limpiarFirma();
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileSignature className="size-4" />
        Consentimiento
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Consentimiento informado"
        description="El paciente firma en la pantalla y se genera el PDF."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cons-servicio">Servicio / procedimiento</Label>
            <Input
              id="cons-servicio"
              value={servicio}
              onChange={(e) => setServicio(e.target.value)}
              maxLength={120}
              placeholder="Extracción, limpieza, restauración…"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Firma del paciente</Label>
              <button
                type="button"
                onClick={limpiarFirma}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Eraser className="size-3.5" />
                Limpiar
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border bg-card">
              <canvas
                ref={canvasRef}
                width={440}
                height={140}
                className="h-[140px] w-full touch-none cursor-crosshair"
                onPointerDown={start_}
                onPointerMove={move}
                onPointerUp={end}
                onPointerLeave={end}
              />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <PenLine className="size-3" />
              Arrastra el dedo o el mouse para firmar.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !firmado}>
              {pending ? "Guardando…" : "Guardar consentimiento"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
