"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface Turno {
  dayOfWeek: number;
  horaIni: string;
  horaFin: string;
}

interface Bloque {
  desde: number;
  hasta: number;
  horaIni: string;
  horaFin: string;
}

function agruparTurnos(turnos: Turno[]): Bloque[] {
  const ordenados = [...turnos].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const bloques: Bloque[] = [];
  for (const t of ordenados) {
    const ultimo = bloques[bloques.length - 1];
    if (
      ultimo &&
      ultimo.horaIni === t.horaIni &&
      ultimo.horaFin === t.horaFin &&
      t.dayOfWeek === ultimo.hasta + 1
    ) {
      ultimo.hasta = t.dayOfWeek;
    } else {
      bloques.push({ desde: t.dayOfWeek, hasta: t.dayOfWeek, horaIni: t.horaIni, horaFin: t.horaFin });
    }
  }
  return bloques;
}

const ERROR_LABEL: Record<string, string> = {
  dia_invalido: "El día debe estar entre 0 y 6",
  hora_invalida: "Las horas deben tener formato HH:MM",
  rango_invalido: "La hora de inicio debe ser menor que la de fin",
  turno_duplicado: "Hay turnos duplicados",
};

export function MiembroTurnos({
  membershipId,
  name,
  turnos,
}: {
  membershipId: string;
  name: string;
  turnos: Turno[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [dias, setDias] = useState<Record<number, { activo: boolean; horaIni: string; horaFin: string }>>({});

  const bloques = agruparTurnos(turnos);

  function abrir() {
    const inicial: Record<number, { activo: boolean; horaIni: string; horaFin: string }> = {};
    for (let d = 0; d < 7; d++) {
      const delDia = turnos.find((t) => t.dayOfWeek === d);
      inicial[d] = delDia
        ? { activo: true, horaIni: delDia.horaIni.slice(0, 5), horaFin: delDia.horaFin.slice(0, 5) }
        : { activo: false, horaIni: "09:00", horaFin: "13:00" };
    }
    setDias(inicial);
    setOpen(true);
  }

  function toggleDia(d: number, activo: boolean) {
    setDias((prev) => ({ ...prev, [d]: { ...(prev[d] ?? { horaIni: "09:00", horaFin: "13:00" }), activo } }));
  }

  function cambiarHora(d: number, campo: "horaIni" | "horaFin", valor: string) {
    setDias((prev) => ({ ...prev, [d]: { ...(prev[d] ?? { activo: true, horaIni: "09:00", horaFin: "13:00" }), [campo]: valor } }));
  }

  function guardar() {
    start(async () => {
      const payload = Object.entries(dias)
        .filter(([, v]) => v.activo)
        .map(([d, v]) => ({ dayOfWeek: Number(d), horaIni: v.horaIni, horaFin: v.horaFin }));
      const res = await fetch(`/api/personal/${membershipId}/horario`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnos: payload }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(ERROR_LABEL[j.error as string] ?? `No se pudo guardar el horario: ${j.error ?? "error"}`);
        return;
      }
      toast.success(`Turnos de ${name} guardados`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {turnos.length === 0
            ? "Define el horario semanal"
            : bloques.length === 1
              ? "1 bloque de turno"
              : `${bloques.length} bloques de turno`}
        </p>
        <Button variant="ghost" size="sm" onClick={abrir}>
          <Pencil className="size-3.5" />
          Editar turnos
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Turnos de ${name}`}
        icon={<CalendarClock className="size-4 text-primary" />}
        description="Activa los días que trabaja y define su rango de horas."
      >
        <div className="space-y-2">
          {DIAS.map((nombre, d) => {
            const v = dias[d] ?? { activo: false, horaIni: "09:00", horaFin: "13:00" };
            return (
              <div key={d} className="rounded-lg border p-3">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <Checkbox
                    checked={v.activo}
                    onChange={(e) => toggleDia(d, e.target.checked)}
                  />
                  <span className="text-sm font-medium">{nombre}</span>
                </label>
                {v.activo ? (
                  <div className="mt-2.5 flex items-center gap-2 pl-6.5">
                    <div className="space-y-1">
                      <Label htmlFor={`ini-${membershipId}-${d}`}>Desde</Label>
                      <Input
                        id={`ini-${membershipId}-${d}`}
                        type="time"
                        value={v.horaIni}
                        onChange={(e) => cambiarHora(d, "horaIni", e.target.value)}
                        className="h-8 w-28"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`fin-${membershipId}-${d}`}>Hasta</Label>
                      <Input
                        id={`fin-${membershipId}-${d}`}
                        type="time"
                        value={v.horaFin}
                        onChange={(e) => cambiarHora(d, "horaFin", e.target.value)}
                        className="h-8 w-28"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={pending}>
            {pending ? "Guardando…" : "Guardar turnos"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
