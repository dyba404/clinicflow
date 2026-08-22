"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";

export interface SucursalOpcion {
  id: string;
  nombre: string;
  slug: string;
}

export function SucursalSelector({
  sucursalId,
  sucursales,
}: {
  sucursalId: string | null;
  sucursales: SucursalOpcion[];
}) {
  const router = useRouter();
  if (sucursales.length === 0) return null;

  return (
    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      Sucursal:
      <Select
        aria-label="Sucursal"
        className="h-8 w-auto text-xs"
        value={sucursalId ?? ""}
        onChange={(e) => {
          document.cookie = `of_sucursal=${e.target.value}; path=/; max-age=${30 * 24 * 3600}`;
          router.refresh();
        }}
      >
        <option value="">Todas</option>
        {sucursales.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </Select>
    </label>
  );
}
