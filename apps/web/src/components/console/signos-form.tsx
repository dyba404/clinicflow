"use client";

import { useCallback, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const RANGOS = {
  paSistolica: { min: 50, max: 260 },
  paDiastolica: { min: 30, max: 160 },
  temperatura: { min: 30, max: 43 },
  fc: { min: 20, max: 220 },
  fr: { min: 5, max: 60 },
  spo2: { min: 50, max: 100 },
} as const;

export function SignosForm({
  admissionId,
  onSaved,
}: {
  admissionId: string;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const [turno, setTurno] = useState("manana");
  const [paSistolica, setPaSistolica] = useState("");
  const [paDiastolica, setPaDiastolica] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [fc, setFc] = useState("");
  const [fr, setFr] = useState("");
  const [spo2, setSpo2] = useState("");
  const [nota, setNota] = useState("");

  const limpiar = useCallback(() => {
    setPaSistolica("");
    setPaDiastolica("");
    setTemperatura("");
    setFc("");
    setFr("");
    setSpo2("");
    setNota("");
  }, []);

  const hayAlguno =
    paSistolica.trim() !== "" ||
    paDiastolica.trim() !== "" ||
    temperatura.trim() !== "" ||
    fc.trim() !== "" ||
    fr.trim() !== "" ||
    spo2.trim() !== "";

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!hayAlguno) {
      toast.error("Registra al menos un signo vital");
      return;
    }
    start(async () => {
      const payload: Record<string, unknown> = { turno };
      const campos: Array<[string, string, boolean]> = [
        ["paSistolica", paSistolica, true],
        ["paDiastolica", paDiastolica, true],
        ["temperatura", temperatura, false],
        ["fc", fc, true],
        ["fr", fr, true],
        ["spo2", spo2, true],
      ];
      for (const [clave, raw, esEntero] of campos) {
        const t = raw.trim();
        if (t === "") continue;
        const n = esEntero ? Number.parseFloat(t) : Number(t);
        const { min, max } = RANGOS[clave as keyof typeof RANGOS];
        if (!Number.isFinite(n) || n < min || n > max) {
          toast.error(`${clave}: valor fuera de rango (${min}–${max})`);
          return;
        }
        payload[clave] = n;
      }
      if (nota.trim()) payload.nota = nota.trim();

      const r = await fetch(`/api/hospitalizacion/admissions/${admissionId}/signos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string; campo?: string } | null;
        const detalle = j?.campo ? `${j.campo}: ` : "";
        toast.error(`No se pudo registrar: ${detalle}${j?.error ?? "error"}`);
        return;
      }
      toast.success("Signos registrados");
      limpiar();
      onSaved();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="turno">Turno</Label>
          <Select id="turno" value={turno} onChange={(e) => setTurno(e.target.value)}>
            <option value="manana">Mañana</option>
            <option value="tarde">Tarde</option>
            <option value="noche">Noche</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Presión arterial (mmHg)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              step={1}
              min={50}
              max={260}
              placeholder="Sis"
              aria-label="PA sistólica"
              value={paSistolica}
              onChange={(e) => setPaSistolica(e.target.value)}
            />
            <span className="text-sm text-muted-foreground">/</span>
            <Input
              type="number"
              inputMode="numeric"
              step={1}
              min={30}
              max={160}
              placeholder="Dia"
              aria-label="PA diastólica"
              value={paDiastolica}
              onChange={(e) => setPaDiastolica(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="temperatura">Temperatura (°C)</Label>
          <Input
            id="temperatura"
            type="number"
            inputMode="decimal"
            step={0.1}
            min={30}
            max={43}
            placeholder="36.5"
            value={temperatura}
            onChange={(e) => setTemperatura(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="fc">FC (lpm)</Label>
            <Input
              id="fc"
              type="number"
              inputMode="numeric"
              step={1}
              min={20}
              max={220}
              value={fc}
              onChange={(e) => setFc(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fr">FR (rpm)</Label>
            <Input
              id="fr"
              type="number"
              inputMode="numeric"
              step={1}
              min={5}
              max={60}
              value={fr}
              onChange={(e) => setFr(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spo2">SpO₂ (%)</Label>
            <Input
              id="spo2"
              type="number"
              inputMode="numeric"
              step={1}
              min={50}
              max={100}
              value={spo2}
              onChange={(e) => setSpo2(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nota">Nota</Label>
        <Textarea
          id="nota"
          rows={2}
          maxLength={1000}
          placeholder="Observación de enfermería (opcional)"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending || !hayAlguno}>
          <Activity className="size-4" />
          Registrar signos
        </Button>
      </div>
    </form>
  );
}
