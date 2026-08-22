"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface OrdenLab {
  id: string;
  nombre: string;
  estado: string;
  createdAt: string;
}

const ETIQUETA: Record<string, string> = {
  ordenada: "Ordenada",
  toma: "Toma de muestra",
  procesada: "Procesada",
  validada: "Validada",
  liberada: "Liberada",
  entregada: "Entregada",
  cancelada: "Cancelada",
};

const BADGE: Record<string, "gray" | "blue" | "violet" | "amber" | "teal" | "green" | "red"> = {
  ordenada: "gray",
  toma: "blue",
  procesada: "violet",
  validada: "amber",
  liberada: "teal",
  entregada: "green",
  cancelada: "red",
};

export function LaboratorioCard({ patientId }: { patientId: string }) {
  const [ordenes, setOrdenes] = useState<OrdenLab[] | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/ordenes?patientId=${encodeURIComponent(patientId)}&tipo=laboratorio`,
        );
        const j = (await r.json().catch(() => ({}))) as { ordenes?: OrdenLab[] };
        if (!cancel) setOrdenes(r.ok ? (j.ordenes ?? []) : []);
      } catch {
        if (!cancel) setOrdenes([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [patientId]);

  if (ordenes === null) {
    return <p className="py-2 text-sm text-muted-foreground">Cargando órdenes…</p>;
  }

  if (ordenes.length === 0) {
    return (
      <div className="space-y-2">
        <p className="py-2 text-sm text-muted-foreground">Sin pedidos de laboratorio todavía.</p>
        <Link
          href="/consola/ordenes"
          className="text-xs font-medium text-primary hover:underline"
        >
          Abrir cola de órdenes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y">
        {ordenes.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{o.nombre}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true, locale: es })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/consola/ordenes"
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver
              </Link>
              <Badge variant={BADGE[o.estado] ?? "gray"}>{ETIQUETA[o.estado] ?? o.estado}</Badge>
            </div>
          </li>
        ))}
      </ul>
      <Link href="/consola/ordenes" className="text-xs font-medium text-primary hover:underline">
        Abrir cola de órdenes
      </Link>
    </div>
  );
}
