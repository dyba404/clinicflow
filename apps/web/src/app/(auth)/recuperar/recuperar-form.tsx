"use client";

import { useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RecuperarForm() {
  const [pending, setPending] = useState(false);
  const [enviado, setEnviado] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = (e.currentTarget.elements.namedItem("email") as HTMLInputElement).value;
    setPending(true);
    fetch("/api/auth/recuperar/solicitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
      .then(() => setEnviado(true))
      .finally(() => setPending(false));
  }

  if (enviado) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <p className="text-sm font-semibold">Revisa tu correo</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Si el correo existe y el envío por email está activo, encontrarás el enlace
          para restablecer tu contraseña. El enlace vence en 1 hora.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white">
          <Sparkles className="size-4" />
        </span>
        <div>
          <p className="text-base font-bold tracking-tight">clinicflow</p>
          <p className="text-xs text-muted-foreground">Restablecer contraseña</p>
        </div>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="rec-email">
            Correo
          </label>
          <Input id="rec-email" name="email" type="email" required />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Enviando…" : "Enviar enlace"}
        </Button>
      </form>
      <p className="mt-5 text-center text-xs text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
