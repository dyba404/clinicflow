"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";

type Plan = {
  id: string;
  planNumber: string;
  titulo: string;
  estado: string;
};

const ESTADO_LABEL: Record<string, string> = {
  draft: "Borrador",
  pending: "Pendiente",
  active: "Activo",
  completed: "Completado",
  archived: "Archivado",
  closed: "Cerrado",
};

export function PlanesCard({ patientId }: { patientId: string }) {
  const [planes, setPlanes] = useState<Plan[] | null>(null);

  useEffect(() => {
    let activo = true;
    fetch(`/api/planes?patient=${patientId}`)
      .then((r) => (r.ok ? r.json() : { planes: [] }))
      .then((j) => {
        if (activo) setPlanes((j.planes ?? []) as Plan[]);
      })
      .catch(() => {
        if (activo) setPlanes([]);
      });
    return () => {
      activo = false;
    };
  }, [patientId]);

  return (
    <div className="space-y-3">
      {planes === null ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Cargando planes…
        </p>
      ) : planes.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ClipboardList className="size-4" /> Sin planes de tratamiento todavía.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {planes.map((p) => (
            <li key={p.id}>
              <Link
                href={`/consola/planes/${p.id}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-accent/50"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{p.planNumber}</span> · {p.titulo}
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {ESTADO_LABEL[p.estado] ?? p.estado}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/consola/planes"
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        Ver todos los planes
      </Link>
    </div>
  );
}
