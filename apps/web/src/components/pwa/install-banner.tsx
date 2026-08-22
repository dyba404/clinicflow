"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type Plataforma = "ios" | "android" | null;

const KEY = "of-pwa-descartado";

function detectarPlataforma(): Plataforma {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

function yaInstalado(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export function InstallBanner() {
  const [plataforma, setPlataforma] = useState<Plataforma>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (yaInstalado()) return;
    if (localStorage.getItem(KEY)) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const det = detectarPlataforma();
    if (!det) return;
    setPlataforma(det);
    setVisible(true);
  }, []);

  if (!visible || !plataforma) return null;

  const descartar = () => {
    localStorage.setItem(KEY, "1");
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-[90] px-4 pb-4">
      <div className="mx-auto flex max-w-xl items-start gap-3 rounded-2xl border bg-card p-4 shadow-lg">
        <Download className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Instala Clinicflow en tu celular</p>
          {plataforma === "ios" ? (
            <p className="mt-1 flex items-start gap-1 text-xs leading-relaxed text-muted-foreground">
              En Safari pulsa <Share className="mt-0.5 inline size-3.5 shrink-0" />
              Compartir, luego «Agregar a inicio» y listo: la app queda en tu
              pantalla como una app más.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Desde el menú del navegador (⋮) pulsa «Instalar aplicación» o
              «Agregar a la pantalla principal»: Clinicflow quedará como una app
              más, sin descargas.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={descartar}
          aria-label="Cerrar"
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
