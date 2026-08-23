"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function PadDeFirma({
  onChange,
  alto = 140,
}: {
  onChange: (dataUrl: string | null) => void;
  alto?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const dibujando = useRef(false);
  const huboTrazo = useRef(false);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = alto * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1c1917";
    setLista(true);
  }, [alto]);

  function punto(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = ref.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    dibujando.current = true;
    huboTrazo.current = true;
    const p = punto(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ref.current?.setPointerCapture(e.pointerId);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const p = punto(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function terminar() {
    if (!dibujando.current) return;
    dibujando.current = false;
    if (ref.current && huboTrazo.current) onChange(ref.current.toDataURL("image/png"));
  }

  function limpiar() {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    huboTrazo.current = false;
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        style={{ height: alto }}
        className="w-full touch-none rounded-lg border bg-white"
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
      />
      {lista ? (
        <Button type="button" size="sm" variant="outline" onClick={limpiar}>
          Limpiar firma
        </Button>
      ) : null}
    </div>
  );
}
