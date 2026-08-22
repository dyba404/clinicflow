"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MemberActions, type Miembro } from "@/app/admin/member-actions";

const ROL_LABEL: Record<string, string> = {
  owner: "Dueño/a",
  receptionist: "Recepción",
  doctor: "Odontólogo/a",
  assistant: "Asistente",
};

const fmtSesion = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function MembersPanel({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [miembros, setMiembros] = useState<Miembro[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    setError(null);
    const res = await fetch(`/api/admin/tenants/${tenantId}/members`);
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(j.miembros)) {
      setError(j.error ?? "error");
      setMiembros(null);
    } else {
      setMiembros(j.miembros as Miembro[]);
    }
    setCargando(false);
  }

  useEffect(() => {
    if (open && miembros === null && !cargando && !error) {
      void cargar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setOpen((v) => !v)}>
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        Miembros
      </Button>

      {open && (
        <div className="mt-2 rounded-lg border bg-card/50 p-3 text-xs">
          {cargando && <p className="text-muted-foreground">Cargando…</p>}
          {error && <p className="text-red-600">Error: {error}</p>}
          {miembros && miembros.length === 0 && (
            <p className="text-muted-foreground">Sin miembros.</p>
          )}
          {miembros && miembros.length > 0 && (
            <ul className="space-y-2">
              {miembros.map((m) => (
                <li key={m.membershipId} className="flex flex-col gap-2 border-b pb-2 last:border-0 last:pb-0 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="truncate text-muted-foreground">{m.email}</p>
                    <p className="text-muted-foreground">
                      {ROL_LABEL[m.role] ?? m.role}
                      {m.ultimaSesion
                        ? ` · última sesión ${fmtSesion.format(new Date(m.ultimaSesion))}`
                        : " · sin sesión registrada"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!m.active && <Badge variant="red">Inactivo</Badge>}
                    {m.lockedAt && <Badge variant="amber">Bloqueado</Badge>}
                    {m.isPlatformAdmin && <Badge variant="violet">Plataforma</Badge>}
                    <MemberActions tenantId={tenantId} miembro={m} onChanged={cargar} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
