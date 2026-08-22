"use client";

import { useEffect, useState } from "react";
import { DatabaseZap, AlertTriangle } from "lucide-react";

const DB_MARKERS = [
  "postgres_no_disponible",
  "ECONNREFUSED",
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "fetch failed",
  "write CONNECTION",
];

function isDbError(error: Error): boolean {
  const text = `${error.name ?? ""} ${error.message ?? ""} ${
    (error as { cause?: { code?: string; message?: string } }).cause?.code ?? ""
  } ${(error as { cause?: { message?: string } }).cause?.message ?? ""}`;
  return DB_MARKERS.some((m) => text.includes(m));
}

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [waiting, setWaiting] = useState(false);
  const db = isDbError(error);

  useEffect(() => {
    if (!db) return;
    setWaiting(true);
    const t = setTimeout(() => setWaiting(false), 8000);
    return () => clearTimeout(t);
  }, [db]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        {db ? (
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <DatabaseZap className="size-6" />
          </span>
        ) : (
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <AlertTriangle className="size-6" />
          </span>
        )}
        <h2 className="text-lg font-semibold tracking-tight">
          {db ? "La base de datos tardó en despertar" : "Algo salió mal"}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {db
            ? "El entorno local estaba suspendido e intentamos levantarlo automáticamente. Espera unos segundos y reintenta."
            : "Ocurrió un error inesperado al cargar esta pantalla."}
        </p>
        <button
          type="button"
          onClick={reset}
          disabled={waiting}
          className="mx-auto mt-5 flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          <span className="animate-none">{waiting ? "Levantando entorno…" : db ? "Reintentar" : "Intentar de nuevo"}</span>
        </button>
        {db ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Si persiste: <code className="rounded bg-muted px-1.5 py-0.5">npm run of:up</code>
          </p>
        ) : null}
      </div>
    </div>
  );
}
