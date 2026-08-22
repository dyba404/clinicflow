"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgePercent, Coins, Save, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fmtPEN } from "@/lib/format";
import { useNavegar } from "@/lib/navegar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DoctorConfig {
  membershipId: string;
  nombre: string;
  porcentaje: number;
}

interface DoctorResumen {
  doctorMembershipId: string;
  nombre: string;
  total: number;
  pagos: number;
}

function ConfigRow({
  doctor,
  pending,
  onSave,
}: {
  doctor: DoctorConfig;
  pending: boolean;
  onSave: (membershipId: string, porcentaje: number) => void;
}) {
  const [valor, setValor] = useState(String(doctor.porcentaje));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const num = Number(valor);
    if (!Number.isFinite(num) || num < 0 || num > 100) {
      toast.error("El porcentaje debe estar entre 0 y 100");
      return;
    }
    onSave(doctor.membershipId, num);
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0 truncate text-sm font-medium">{doctor.nombre}</span>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-24 pr-7 tabular-nums"
            disabled={pending}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            %
          </span>
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Guardando…" : <><Save className="size-4" /> Guardar</>}
        </Button>
      </div>
    </form>
  );
}

export function ComisionesClient({
  doctores,
  resumen,
  periodo,
}: {
  doctores: DoctorConfig[];
  resumen: DoctorResumen[];
  periodo: string;
}) {
  const router = useRouter();
  const ir = useNavegar();
  const [pending, start] = useTransition();
  const [mes, setMes] = useState(periodo);

  function cambiarMes(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!/^\d{4}-\d{2}$/.test(mes)) return;
    ir(`/consola/comisiones?periodo=${mes}`);
  }

  function guardarPorcentaje(membershipId: string, porcentaje: number) {
    start(async () => {
      const res = await fetch("/api/comisiones/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, porcentaje }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo guardar: ${j.error ?? "error"}`);
        return;
      }
      const doc = doctores.find((d) => d.membershipId === membershipId);
      toast.success(`Comisión de ${doc?.nombre ?? "doctor"}: ${porcentaje}%`);
      router.refresh();
    });
  }

  const totalMes = resumen.reduce((acc, r) => acc + r.total, 0);

  return (
    <>
      <div className="flex items-center justify-between">
        <form onSubmit={cambiarMes} className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <Input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="w-44"
          />
          <Button type="submit" size="sm" variant="outline">
            Ver mes
          </Button>
        </form>
        <Badge variant="secondary">Periodo {periodo}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-5 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <BadgePercent className="size-4 text-primary" />
              Porcentaje por doctor
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {doctores.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No tienes odontólogos activos en el equipo.
              </p>
            ) : (
              <div className="divide-y">
                {doctores.map((d) => (
                  <ConfigRow
                    key={d.membershipId}
                    doctor={d}
                    pending={pending}
                    onSave={guardarPorcentaje}
                  />
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              La comisión se calcula automáticamente sobre cada pago asociado a una cita
              atendida por el doctor. Si el porcentaje es 0, el pago se omite.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Coins className="size-4 text-primary" />
              Comisiones del mes
            </CardTitle>
          </CardHeader>
          {resumen.length === 0 ? (
            <CardContent className="p-5 pt-0">
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sin comisiones registradas para {periodo}. Se generan al registrar pagos de
                citas con doctor asignado.
              </p>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor</TableHead>
                  <TableHead className="text-center">Pagos</TableHead>
                  <TableHead className="text-right">Comisión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumen.map((r) => (
                  <TableRow key={r.doctorMembershipId}>
                    <TableCell className="text-sm font-medium">{r.nombre}</TableCell>
                    <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                      {r.pagos}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {fmtPEN(r.total)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="text-sm font-semibold">Total del mes</TableCell>
                  <TableCell className="text-center text-sm font-semibold tabular-nums">
                    {resumen.reduce((acc, r) => acc + r.pagos, 0)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-bold tabular-nums">
                    {fmtPEN(totalMes)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
