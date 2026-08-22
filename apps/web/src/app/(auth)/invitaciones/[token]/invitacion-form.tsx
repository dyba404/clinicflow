"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ROLES: Record<string, string> = {
  owner: "Dueño/a",
  receptionist: "Recepción",
  assistant: "Asistente",
  doctor: "Odontólogo/a",
};

export function AceptarInvitacionForm({
  token,
  email,
  role,
  clinicaNombre,
}: {
  token: string;
  email: string;
  role: string;
  clinicaNombre: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const nombre = (form.elements.namedItem("nombre") as HTMLInputElement | null)?.value ?? "";
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    setPending(true);
    fetch(`/api/auth/invitaciones/${token}/aceptar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre || undefined, password }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "error");
        toast.success(`¡Bienvenido a ${clinicaNombre}!`);
        router.push("/consola");
        router.refresh();
      })
      .catch((err: Error) => {
        toast.error(
          err.message === "password_corta"
            ? "La contraseña debe tener al menos 8 caracteres."
            : err.message === "password_no_coincide"
              ? "Ya tienes cuenta: usa tu contraseña actual."
              : err.message === "invitacion_expirada"
                ? "Esta invitación expiró. Pide que te inviten de nuevo."
                : "No se pudo aceptar la invitación.",
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
          <p className="text-xs text-muted-foreground">Únete a un equipo</p>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-border-subtle bg-accent/40 p-4 text-sm">
        <p>
          Te invitaron a <strong>{clinicaNombre}</strong> como{" "}
          <strong>{ROLES[role] ?? role}</strong>.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Correo: {email}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="inv-nombre">
            Tu nombre <span className="text-muted-foreground">(si no tienes cuenta)</span>
          </label>
          <Input id="inv-nombre" name="nombre" placeholder="Nombre completo" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="inv-password">
            Contraseña
          </label>
          <Input
            id="inv-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="Mínimo 8 caracteres"
          />
          <p className="text-[11px] text-muted-foreground">
            Si ya tienes cuenta en Clinicflow, escribe tu contraseña actual.
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Uniendo…" : "Aceptar invitación"}
        </Button>
      </form>
    </div>
  );
}
