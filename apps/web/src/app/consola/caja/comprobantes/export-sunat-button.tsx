"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const RANGOS = [
  { value: "mes_actual", label: "Este mes" },
  { value: "mes_pasado", label: "Mes pasado" },
  { value: "ultimos_30", label: "Últimos 30 días" },
];

function formatoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function rangoActual(opcion: string): { desde: string; hasta: string } {
  const hoy = new Date();
  if (opcion === "mes_actual") {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { desde: formatoLocal(inicio), hasta: formatoLocal(hoy) };
  }
  if (opcion === "mes_pasado") {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    return { desde: formatoLocal(inicio), hasta: formatoLocal(fin) };
  }
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 29);
  return { desde: formatoLocal(inicio), hasta: formatoLocal(hoy) };
}

export function ExportSunatButton() {
  const [opcion, setOpcion] = useState("mes_actual");
  const { desde, hasta } = rangoActual(opcion);

  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label="Rango del reporte"
        value={opcion}
        onChange={(e) => setOpcion(e.target.value)}
        className="h-8 w-40 text-xs"
      >
        {RANGOS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Select>
      <a
        href={`/api/export/sunat?desde=${desde}&hasta=${hasta}`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <Download className="size-3.5" />
        Exportar SUNAT
      </a>
    </div>
  );
}
