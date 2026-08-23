"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Lock, ShieldCheck, Stethoscope, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Vista = "login" | "recuperar" | "otp" | "activado";

export function PortalLogin({ clinica, clinicaNombre }: { clinica: string; clinicaNombre: string }) {
  const [vista, setVista] = useState<Vista>("login");
  const [celular, setCelular] = useState("");
  const [password, setPassword] = useState("");
  const [documento, setDocumento] = useState("");
  const [fnac, setFnac] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const r = await fetch(`/api/portal/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinica, celular, password }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(
          j.error === "cuenta_bloqueada"
            ? "Demasiados intentos. Espera 15 minutos o recupera tu contraseña."
            : "Celular o contraseña incorrectos.",
        );
        return;
      }
      window.location.href = `/${clinica}/portal/mio`;
    } catch {
      setError("No se pudo iniciar sesión. Intenta nuevamente.");
    } finally {
      setCargando(false);
    }
  }

  async function solicitarRecuperacion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const r = await fetch(`/api/portal/auth/recuperar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinica, celular, documento, fnac }),
      });
      if (!r.ok) {
        setError("No se pudo verificar tu identidad. Revisa los datos.");
        return;
      }
      setMensaje("Si tus datos coinciden, te enviamos un código a tu celular o correo.");
      setVista("otp");
    } catch {
      setError("No se pudo procesar la solicitud.");
    } finally {
      setCargando(false);
    }
  }

  async function confirmarRecuperacion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const r = await fetch(`/api/portal/auth/recuperar/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinica, celular, codigo, password: nuevaPassword }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(
          j.error === "otp_intentos_agotados"
            ? "Código agotado. Solicita uno nuevo."
            : j.error === "password_corta"
              ? "La contraseña debe tener al menos 8 caracteres."
              : j.error === "password_obvia"
                ? "Esa contraseña es muy fácil de adivinar. Elige otra."
                : "Código incorrecto o vencido.",
        );
        return;
      }
      setMensaje("Tu contraseña fue cambiada. Ya puedes entrar.");
      setVista("login");
      setPassword("");
      setCodigo("");
      setNuevaPassword("");
    } catch {
      setError("No se pudo cambiar la contraseña.");
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
          <p className="text-sm text-muted-foreground">Portal del paciente</p>
        </header>

        <div className="rounded-2xl border border-border bg-card p-6">
          {mensaje && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              {mensaje}
            </div>
          )}
          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}

          {vista === "login" && (
            <form onSubmit={entrar} className="space-y-4">
              <div>
                <label htmlFor="celular" className="mb-1.5 block text-sm font-medium text-foreground">
                  Celular
                </label>
                <input
                  id="celular"
                  className={inputCls}
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                  placeholder="987654321"
                  autoComplete="tel"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  className={inputCls}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={cargando}>
                {cargando ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                Entrar
              </Button>
              <button
                type="button"
                onClick={() => {
                  setVista("recuperar");
                  setError(null);
                  setMensaje(null);
                }}
                className="w-full text-center text-sm text-primary underline-offset-2 hover:underline"
              >
                Olvidé mi contraseña
              </button>
            </form>
          )}

          {vista === "recuperar" && (
            <form onSubmit={solicitarRecuperacion} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Verifica tu identidad para enviarte un código de recuperación.
              </p>
              <div>
                <label htmlFor="rec-celular" className="mb-1.5 block text-sm font-medium text-foreground">
                  Celular registrado
                </label>
                <input
                  id="rec-celular"
                  className={inputCls}
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                  placeholder="987654321"
                  required
                />
              </div>
              <div>
                <label htmlFor="rec-documento" className="mb-1.5 block text-sm font-medium text-foreground">
                  Número de documento (DNI)
                </label>
                <input
                  id="rec-documento"
                  className={inputCls}
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="rec-fnac" className="mb-1.5 block text-sm font-medium text-foreground">
                  Fecha de nacimiento
                </label>
                <input
                  id="rec-fnac"
                  type="date"
                  className={inputCls}
                  value={fnac}
                  onChange={(e) => setFnac(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={cargando}>
                {cargando ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                Enviar código
              </Button>
              <button
                type="button"
                onClick={() => {
                  setVista("login");
                  setError(null);
                }}
                className="w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
              >
                Volver
              </button>
            </form>
          )}

          {vista === "otp" && (
            <form onSubmit={confirmarRecuperacion} className="space-y-4">
              <div>
                <label htmlFor="otp-codigo" className="mb-1.5 block text-sm font-medium text-foreground">
                  Código recibido
                </label>
                <input
                  id="otp-codigo"
                  className={`${inputCls} text-center text-lg tracking-widest`}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="000000"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">Vence en 10 minutos.</p>
              </div>
              <div>
                <label htmlFor="otp-password" className="mb-1.5 block text-sm font-medium text-foreground">
                  Nueva contraseña
                </label>
                <input
                  id="otp-password"
                  type="password"
                  className={inputCls}
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
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
                Cambiar contraseña
              </Button>
              <button
                type="button"
                onClick={() => {
                  setVista("recuperar");
                  setError(null);
                  setMensaje(null);
                }}
                className="w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
              >
                Volver
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿Primera vez? Pide en recepción que activen tu portal.
        </p>
      </div>
    </main>
  );
}
