"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type Estado = string;

const SIGUIENTE: Record<Estado, Array<{ to: Estado; label: string; requiereMotivo?: boolean }>> = {
  draft: [{ to: "pending", label: "Enviar a aprobación" }],
  pending: [
    { to: "active", label: "Iniciar tratamiento" },
    { to: "draft", label: "Volver a borrador" },
  ],
  active: [
    { to: "completed", label: "Marcar completado" },
    { to: "archived", label: "Archivar" },
    { to: "closed", label: "Cerrar", requiereMotivo: true },
  ],
  completed: [],
  archived: [],
  closed: [],
};

export function AccionesPlan({
  planId,
  estado,
  canDelete,
}: {
  planId: string;
  estado: Estado;
  canDelete: boolean;
}) {
  const [cargando, setCargando] = useState(false);
  const router = useRouter();
  const opciones = SIGUIENTE[estado] ?? [];

  async function transicion(to: Estado, requiereMotivo?: boolean) {
    let closureReason: string | null = null;
    if (requiereMotivo) {
      closureReason = window.prompt("Motivo del cierre:")?.trim() ?? null;
      if (!closureReason) return;
    }
    setCargando(true);
    try {
      const r = await fetch(`/api/planes/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: to, closureReason }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error(`No se pudo actualizar: ${j.error ?? "error"}`);
        return;
      }
      toast.success("Plan actualizado");
      router.refresh();
    } finally {
      setCargando(false);
    }
  }

  async function eliminar() {
    if (!window.confirm("¿Eliminar este plan borrador?")) return;
    setCargando(true);
    try {
      const r = await fetch(`/api/planes/${planId}`, { method: "DELETE" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error(`No se pudo eliminar: ${j.error ?? "error"}`);
        return;
      }
      toast.success("Plan eliminado");
      router.push("/consola/planes");
      router.refresh();
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {cargando ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      {opciones.map((o) => (
        <Button
          key={o.to}
          size="sm"
          variant={o.to === "closed" || o.to === "archived" ? "outline" : "default"}
          disabled={cargando}
          onClick={() => transicion(o.to, o.requiereMotivo)}
        >
          {o.label}
        </Button>
      ))}
      {canDelete ? (
        <Button size="sm" variant="destructive" disabled={cargando} onClick={eliminar}>
          Eliminar
        </Button>
      ) : null}
    </div>
  );
}

export function AccionesItem({
  planId,
  itemId,
  estado,
}: {
  planId: string;
  itemId: string;
  estado: Estado;
}) {
  const [cargando, setCargando] = useState(false);
  const router = useRouter();
  const puedeDone = estado === "in_progress";
  const puedeIniciar = estado === "pending";

  async function cambiar(to: Estado) {
    setCargando(true);
    try {
      const r = await fetch(`/api/planes/${planId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, estado: to }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error(`No se pudo actualizar: ${j.error ?? "error"}`);
        return;
      }
      toast.success("Ítem actualizado");
      router.refresh();
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {puedeIniciar ? (
        <Button size="sm" variant="outline" disabled={cargando} onClick={() => cambiar("in_progress")}>
          Iniciar
        </Button>
      ) : null}
      {puedeDone ? (
        <>
          <Button size="sm" disabled={cargando} onClick={() => cambiar("done")}>
            Completar
          </Button>
          <Button size="sm" variant="outline" disabled={cargando} onClick={() => cambiar("cancelled")}>
            Cancelar
          </Button>
        </>
      ) : null}
      {cargando ? <Loader2 className="size-3.5 animate-spin" /> : null}
    </div>
  );
}
