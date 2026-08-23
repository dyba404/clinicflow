"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Shuffle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function RoundRobinToggle({ activo }: { activo: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(activo);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !checked;
    setChecked(next);
    setSaving(true);
    try {
      const res = await fetch("/api/config/round-robin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundRobin: next }),
      });
      if (!res.ok) {
        setChecked(!next);
        toast.error("No se pudo guardar la configuración.");
        return;
      }
      toast.success(next ? "Round-robin activado." : "Round-robin desactivado.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={toggle}
      disabled={saving}
      className="flex w-full items-center gap-3 rounded-xl border border-border-subtle bg-card p-3 text-left transition-colors hover:bg-surface-hover disabled:opacity-60"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Shuffle className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium">Asignación automática (round-robin)</span>
          {checked ? (
            <Badge variant="green">Activo</Badge>
          ) : (
            <Badge variant="gray">Desactivado</Badge>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Las solicitudes sin doctor preferido se asignan al odontólogo activo con menos
          citas ese día. Si el paciente elige doctor, se respeta su preferencia.
        </span>
      </span>
      <span
        className={`relative inline-flex size-5 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[2px]" : "translate-x-[-2px]"
          }`}
        />
      </span>
    </button>
  );
}
