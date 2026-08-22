"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ERRORES: Record<string, string> = {
  clinica_invalida: "El nombre del consultorio debe tener entre 3 y 60 caracteres.",
  nombre_invalido: "Tu nombre debe tener entre 3 y 60 caracteres.",
  email_invalido: "El correo no es válido.",
  password_corta: "La contraseña debe tener al menos 8 caracteres.",
  slug_invalido: "La dirección web no es válida.",
  email_ya_registrado: "Ese correo ya está registrado. Inicia sesión.",
  slug_ocupado: "Esa dirección web ya está en uso. Elige otra.",
};

export function SignupForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [clinica, setClinica] = useState("");
  const [slug, setSlug] = useState("");

  function autoSlug(nombre: string) {
    return nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = {
      clinica: (form.elements.namedItem("clinica") as HTMLInputElement).value,
      slug,
      nombre: (form.elements.namedItem("nombre") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      password: (form.elements.namedItem("password") as HTMLInputElement).value,
    };
    setPending(true);
    fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "error");
        toast.success("Consultorio creado. ¡Bienvenido!");
        router.push("/consola");
        router.refresh();
      })
      .catch((err: Error) => {
        toast.error(ERRORES[err.message] ?? "No se pudo crear la cuenta.");
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
          <p className="text-xs text-muted-foreground">
            Crea tu consultorio, gratis para empezar
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="su-clinica">
            Nombre del consultorio
          </label>
          <Input
            id="su-clinica"
            name="clinica"
            required
            placeholder="Clínica Dental Sonrisa"
            value={clinica}
            onChange={(e) => {
              setClinica(e.target.value);
              setSlug(autoSlug(e.target.value));
            }}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="su-slug">
            Dirección de tu página de reservas
          </label>
          <div className="flex items-center overflow-hidden rounded-md border border-input bg-card">
            <span className="pl-3 text-xs text-muted-foreground">tudominio.pe/</span>
            <Input
              id="su-slug"
              className="border-0 shadow-none focus-visible:ring-0"
              value={slug}
              onChange={(e) => setSlug(autoSlug(e.target.value))}
              required
              placeholder="mi-clinica"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Aquí reservarán tus pacientes. Solo letras, números y guiones.
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="su-nombre">
            Tu nombre
          </label>
          <Input id="su-nombre" name="nombre" required placeholder="Dra. Ana Valdéz" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="su-email">
            Correo
          </label>
          <Input id="su-email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="su-password">
            Contraseña
          </label>
          <Input
            id="su-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creando consultorio…" : "Crear mi consultorio"}
        </Button>
      </form>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
