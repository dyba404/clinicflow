"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Send, Check, X, Layers, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fmtPEN } from "@/lib/format";

interface ItemPresupuesto {
  servicioId?: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

interface Cuota {
  id: string;
  n: number;
  monto: string;
  pagado: string;
  vence: string | null;
  estado: string;
}

const ESTADO_BADGE: Record<string, "gray" | "blue" | "green" | "red" | "violet"> = {
  borrador: "gray",
  enviado: "blue",
  aprobado: "green",
  rechazado: "red",
  convertido: "violet",
};

const CUOTA_BADGE: Record<string, "gray" | "blue" | "green" | "red" | "amber"> = {
  pendiente: "gray",
  parcial: "blue",
  pagada: "green",
  vencida: "red",
  cancelada: "amber",
};

const CUOTA_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  pagada: "Pagada",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

export interface PresupuestoResumen {
  id: string;
  patientNombre: string;
  titulo: string;
  estado: string;
  total: number;
  expiraEn: string | null;
  nota: string | null;
  items: ItemPresupuesto[];
}

export function PresupuestoDetalleDialog({
  presupuesto,
}: {
  presupuesto: PresupuestoResumen;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [estado, setEstado] = useState(presupuesto.estado);
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [cargandoCuotas, setCargandoCuotas] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [n, setN] = useState("2");

  useEffect(() => {
    setEstado(presupuesto.estado);
  }, [presupuesto.estado, open]);

  useEffect(() => {
    if (!open) return;
    let activo = true;
    setCargandoCuotas(true);
    fetch(`/api/presupuestos/${presupuesto.id}/cuotas`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!activo) return;
        if (!r.ok) {
          setCuotas([]);
          return;
        }
        setCuotas(j.cuotas ?? []);
      })
      .catch(() => {
        if (activo) setCuotas([]);
      })
      .finally(() => {
        if (activo) setCargandoCuotas(false);
      });
    return () => {
      activo = false;
    };
  }, [open, presupuesto.id]);

  function transicion(nuevo: "enviado" | "aprobado" | "rechazado") {
    start(async () => {
      const res = await fetch(`/api/presupuestos/${presupuesto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudo cambiar el estado: ${j.error ?? "error"}`);
        return;
      }
      setEstado(j.estado ?? nuevo);
      if (nuevo === "aprobado" && j.emailEnviado) {
        toast.success("Presupuesto aprobado y correo enviado al paciente");
      } else {
        toast.success(
          nuevo === "enviado"
            ? "Presupuesto enviado al paciente"
            : nuevo === "aprobado"
              ? "Presupuesto aprobado"
              : "Presupuesto rechazado",
        );
      }
      router.refresh();
    });
  }

  function generarCuotas() {
    const num = Number(n);
    if (!Number.isInteger(num) || num < 1 || num > 24) {
      toast.error("El número de cuotas debe estar entre 1 y 24");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/presupuestos/${presupuesto.id}/cuotas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n: num }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`No se pudieron generar las cuotas: ${j.error ?? "error"}`);
        return;
      }
      toast.success(`${num} cuotas generadas correctamente`);
      setGenerando(false);
      const rc = await fetch(`/api/presupuestos/${presupuesto.id}/cuotas`);
      const jc = await rc.json().catch(() => ({}));
      if (rc.ok) setCuotas(jc.cuotas ?? []);
      router.refresh();
    });
  }

  const totalCuotas = cuotas.reduce((acc, c) => acc + Number(c.monto), 0);
  const totalPagado = cuotas.reduce((acc, c) => acc + Number(c.pagado), 0);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Eye className="size-4" />
        Ver
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={presupuesto.titulo}
        icon={<Eye className="size-4 text-primary" />}
        description={`Paciente: ${presupuesto.patientNombre}`}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={ESTADO_BADGE[estado] ?? "gray"}>{estado}</Badge>
            <Badge variant="outline">{fmtPEN(presupuesto.total)}</Badge>
            {presupuesto.expiraEn ? (
              <Badge variant="amber">Vence {presupuesto.expiraEn}</Badge>
            ) : null}
          </div>

          {presupuesto.nota ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {presupuesto.nota}
            </p>
          ) : null}

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Servicio</th>
                  <th className="px-3 py-2 text-center font-medium">Cant.</th>
                  <th className="px-3 py-2 text-right font-medium">P. unitario</th>
                  <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {presupuesto.items.map((it, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{it.descripcion}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{it.cantidad}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtPEN(Number(it.precioUnitario))}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {fmtPEN(Number(it.precioUnitario) * it.cantidad)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/30">
                  <td colSpan={3} className="px-3 py-2 font-semibold">
                    Total
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {fmtPEN(presupuesto.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {(estado === "borrador" || estado === "enviado") && (
            <div className="flex flex-wrap gap-2">
              {estado === "borrador" ? (
                <Button size="sm" onClick={() => transicion("enviado")} disabled={pending}>
                  {pending ? "Enviando…" : <><Send className="size-4" /> Enviar</>}
                </Button>
              ) : null}
              {estado === "enviado" ? (
                <>
                  <Button size="sm" onClick={() => transicion("aprobado")} disabled={pending}>
                    {pending ? "Aprobando…" : <><Check className="size-4" /> Aprobar</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => transicion("rechazado")}
                    disabled={pending}
                  >
                    {pending ? "Rechazando…" : <><X className="size-4" /> Rechazar</>}
                  </Button>
                </>
              ) : null}
            </div>
          )}

          {estado === "aprobado" && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Layers className="size-4 text-primary" />
                  Cuotas
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setGenerando((v) => !v)}
                  disabled={pending}
                >
                  <Layers className="size-4" />
                  Generar cuotas
                </Button>
              </div>

              {generando ? (
                <div className="flex items-end gap-2">
                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor="cuotas-n"
                    >
                      Número de cuotas (1-24)
                    </label>
                    <Input
                      id="cuotas-n"
                      type="number"
                      min={1}
                      max={24}
                      value={n}
                      onChange={(e) => setN(e.target.value)}
                      className="w-32 tabular-nums"
                    />
                  </div>
                  <Button size="sm" onClick={generarCuotas} disabled={pending}>
                    {pending ? "Generando…" : "Generar"}
                  </Button>
                </div>
              ) : null}

              {cargandoCuotas ? (
                <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando cuotas…
                </p>
              ) : cuotas.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">
                  Sin cuotas todavía. Genera cuotas para dividir el pago del presupuesto.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">#</th>
                          <th className="px-3 py-2 font-medium">Monto</th>
                          <th className="px-3 py-2 font-medium">Pagado</th>
                          <th className="px-3 py-2 font-medium">Vence</th>
                          <th className="px-3 py-2 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cuotas.map((c) => (
                          <tr key={c.id} className="border-t">
                            <td className="px-3 py-2 tabular-nums">{c.n}</td>
                            <td className="px-3 py-2 font-medium tabular-nums">
                              {fmtPEN(Number(c.monto))}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {fmtPEN(Number(c.pagado))}
                            </td>
                            <td className="px-3 py-2 tabular-nums">{c.vence ?? "—"}</td>
                            <td className="px-3 py-2">
                              <Badge variant={CUOTA_BADGE[c.estado] ?? "gray"}>
                                {CUOTA_LABEL[c.estado] ?? c.estado}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t bg-muted/30">
                          <td className="px-3 py-2 font-semibold">Total</td>
                          <td className="px-3 py-2 font-bold tabular-nums">
                            {fmtPEN(totalCuotas)}
                          </td>
                          <td className="px-3 py-2 font-bold text-emerald-700 tabular-nums">
                            {fmtPEN(totalPagado)}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    El pago de cuotas se registra desde{" "}
                    <Link href="/consola/caja" className="text-primary underline underline-offset-2">
                      Caja
                    </Link>
                    . Una vez registrado el pago, usa la API{" "}
                    <code className="rounded bg-muted px-1 py-0.5">POST /api/cuotas/:id/pagar</code>{" "}
                    con el paymentId para marcar la cuota como pagada.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
