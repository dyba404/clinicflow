"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PrimerAccesoForm({ destino }: { destino: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const actual = (form.elements.namedItem("actual") as HTMLInputElement).value;
    const nueva = (form.elements.namedItem("nueva") as HTMLInputElement).value;
    const confirmar = (form.elements.namedItem("confirmar") as HTMLInputElement).value;
    if (nueva !== confirmar) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }
    setPending(true);
    fetch("/api/auth/cambiar-contrasena", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actual, nueva }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error ?? "error");
        }
        toast.success("Contraseña actualizada");
        router.push(destino);
        router.refresh();
      })
      .catch((err: Error) => {
        toast.error(
          err.message === "contraseña_actual_invalida"
            ? "La contraseña actual no es correcta"
            : err.message === "contraseña_invalida"
              ? "La nueva contraseña debe tener al menos 8 caracteres y ser distinta a la actual"
              : "No se pudo cambiar la contraseña",
        );
        setPending(false);
      });
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white">
          <KeyRound className="size-4" />
        </span>
        <div>
          <p className="text-base font-bold tracking-tight">clinicflow</p>
          <p className="text-xs text-muted-foreground">
            Establece tu contraseña nueva
          </p>
        </div>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        Por seguridad, debes cambiar la contraseña temporal antes de continuar.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="pa-actual">
            Contraseña actual
          </label>
          <Input id="pa-actual" name="actual" type="password" autoComplete="current-password" required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="pa-nueva">
            Nueva contraseña
          </label>
          <Input
            id="pa-nueva"
            name="nueva"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="pa-confirmar">
            Repite la nueva contraseña
          </label>
          <Input
            id="pa-confirmar"
            name="confirmar"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Guardando…" : "Cambiar contraseña"}
        </Button>
      </form>
    </div>
  );
}
