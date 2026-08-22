"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    setPending(true);
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error ?? "error");
        }
        const j = await r.json().catch(() => ({}));
        router.push(typeof j.redirect === "string" ? j.redirect : "/consola");
        router.refresh();
      })
      .catch((err: Error) => {
        toast.error(
          err.message === "credenciales_invalidas"
            ? "Correo o contraseña incorrectos"
            : err.message === "cuenta_bloqueada"
              ? "Cuenta bloqueada. Contacta a soporte."
              : err.message === "fuera_de_turno"
                ? "Estás fuera de tu horario de turno"
                : err.message === "sin_acceso"
                  ? "Tu cuenta no tiene acceso a ningún consultorio"
                  : "No se pudo iniciar sesión",
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
          <p className="text-xs text-muted-foreground">Inicia sesión en tu consultorio</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="login-email">
            Correo
          </label>
          <Input id="login-email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="login-password">
            Contraseña
          </label>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Iniciando sesión…" : "Iniciar sesión"}
        </Button>
      </form>

      <div className="mt-5 space-y-2 text-center text-xs text-muted-foreground">
        <Link href="/recuperar" className="block hover:text-foreground">
          ¿Olvidaste tu contraseña?
        </Link>
        <p>
          ¿Sin cuenta?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Registra tu consultorio
          </Link>
        </p>
      </div>
    </div>
  );
}
