"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = (e.currentTarget.elements.namedItem("password") as HTMLInputElement).value;
    setPending(true);
    fetch(`/api/auth/recuperar/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "error");
        toast.success("Contraseña actualizada. Inicia sesión.");
        router.push("/login");
      })
      .catch((err: Error) => {
        toast.error(
          err.message === "password_corta"
            ? "La contraseña debe tener al menos 8 caracteres."
            : "El enlace no es válido o ya expiró.",
        );
        setPending(false);
      });
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white">
          <Sparkles className="size-4" />
        </span>
        <div>
          <p className="text-base font-bold tracking-tight">clinicflow</p>
          <p className="text-xs text-muted-foreground">Nueva contraseña</p>
        </div>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="reset-password">
            Nueva contraseña
          </label>
          <Input
            id="reset-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </div>
  );
}
