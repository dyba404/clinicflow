"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";

export function BloqueoChip({
  id,
  motivo,
  className,
  style,
}: {
  id: string;
  motivo: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function eliminar() {
    start(async () => {
      const res = await fetch(`/api/bloqueos?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(`No se pudo eliminar el bloqueo: ${j.error ?? "error"}`);
        return;
      }
      toast.success("Bloqueo eliminado.");
      router.refresh();
    });
  }

  return (
    <div
      className={`${className ?? ""} group`}
      style={style}
      title={motivo || "Bloqueado"}
    >
      <span className="truncate">{motivo || "Bloqueado"}</span>
      <button
        type="button"
        aria-label="Eliminar bloqueo"
        onClick={eliminar}
        disabled={pending}
        className="ml-auto hidden shrink-0 rounded p-0.5 text-muted-foreground hover:bg-card hover:text-foreground group-hover:block disabled:opacity-50"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
