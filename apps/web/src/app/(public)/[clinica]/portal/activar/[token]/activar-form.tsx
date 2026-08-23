"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Lock, Stethoscope, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ActivarPortal({
  clinica,
  clinicaNombre,
  token,
}: {
  clinica: string;
  clinicaNombre: string;
  token: string;
}) {
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  async function activar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setCargando(true);
    try {
      const r = await fetch(`/api/portal/activar/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(
          j.error === "password_corta"
            ? "La contraseña debe tener al menos 8 caracteres."
            : j.error === "password_obvia"
              ? "Esa contraseña es muy fácil de adivinar. Elige otra."
              : "El enlace no es válido o ya expiró. Pide uno nuevo en recepción.",
        );
        return;
      }
      setListo(true);
      window.setTimeout(() => {
        window.location.href = `/${clinica}/portal/mio`;
      }, 1200);
    } catch {
      setError("No se pudo activar el portal. Intenta nuevamente.");
    } finally {
      setCargando(false);
    }
  }

  const inputCls =
    "flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        <header className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary">
            <Stethoscope className="size-6 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">{clinicaNombre}</h1>
          <p className="text-sm text-muted-foreground">Activa tu portal de paciente</p>
        </header>

        <div className="rounded-2xl border border-border bg-card p-6">
          {listo ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="size-10 text-green-600" />
              <p className="font-medium text-foreground">¡Portal activado!</p>
              <p className="text-sm text-muted-foreground">Entrando a tu portal…</p>
            </div>
          ) : (
            <form onSubmit={activar} className="space-y-4">
              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <XCircle className="mt-0.5 size-4 shrink-0" />
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
                  Nueva contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  className={inputCls}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label htmlFor="confirmar" className="mb-1.5 block text-sm font-medium text-foreground">
                  Repite la contraseña
                </label>
                <input
                  id="confirmar"
                  type="password"
                  className={inputCls}
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Mínimo 8 caracteres. No uses tu DNI ni tu celular.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={cargando}>
                {cargando ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                Crear contraseña y entrar
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
