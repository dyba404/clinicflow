"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Check, Mail, RefreshCw, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NotificacionesForm({
  recordatorio24h,
  confirmacionSolicitud,
  emailOperativo,
  plantillaRecordatorio,
  idiomaPlantilla,
  resenaAutomatica,
  recallAuto,
  digestDiario,
}: {
  recordatorio24h: boolean;
  confirmacionSolicitud: boolean;
  emailOperativo: boolean;
  plantillaRecordatorio: string;
  idiomaPlantilla: string;
  resenaAutomatica: boolean;
  recallAuto: boolean;
  digestDiario: boolean;
}) {
  const router = useRouter();
  const [r24, setR24] = useState(recordatorio24h);
  const [conf, setConf] = useState(confirmacionSolicitud);
  const [plantilla, setPlantilla] = useState(plantillaRecordatorio);
  const [idioma, setIdioma] = useState(idiomaPlantilla);
  const [resena, setResena] = useState(resenaAutomatica);
  const [recall, setRecall] = useState(recallAuto);
  const [digest, setDigest] = useState(digestDiario);
  const [saving, setSaving] = useState(false);
  const dirty =
    r24 !== recordatorio24h ||
    conf !== confirmacionSolicitud ||
    plantilla !== plantillaRecordatorio ||
    idioma !== idiomaPlantilla ||
    resena !== resenaAutomatica ||
    recall !== recallAuto ||
    digest !== digestDiario;

  async function guardar() {
    setSaving(true);
    try {
      const res = await fetch("/api/config/notificaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordatorio24h: r24,
          confirmacionSolicitud: conf,
          plantillaRecordatorio: plantilla,
          idiomaPlantilla: idioma,
          resenaAutomatica: resena,
          recallAuto: recall,
          digestDiario: digest,
        }),
      });
      if (!res.ok) {
        toast.error("No se pudo guardar la configuración.");
        return;
      }
      toast.success("Configuración guardada.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
        <CardTitle className="text-sm font-medium">Avisos automáticos</CardTitle>
        <Button size="sm" onClick={guardar} disabled={!dirty || saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-5 pt-0">
        <Toggle
          icon={Check}
          label="Confirmación de solicitud"
          detail="Email con la hora exacta y enlace privado para reprogramar o cancelar."
          checked={conf}
          onChange={setConf}
          disponible={emailOperativo}
        />
        <Toggle
          icon={Bell}
          label="Recordatorio 24 h antes"
          detail="Email recordatorio el día previo a cada cita confirmada."
          checked={r24}
          onChange={setR24}
          disponible={emailOperativo}
        />
        <Toggle
          icon={Star}
          label="Reseña automática post-atención"
          detail="Al marcar una cita como atendida se envía la solicitud de reseña de Google (requiere URL de reseñas configurada)."
          checked={resena}
          onChange={setResena}
          disponible={emailOperativo}
        />
        <Toggle
          icon={RefreshCw}
          label="Recall automático mensual"
          detail="Cada mes se contacta a pacientes sin visitas en 6+ meses (máximo 1 envío cada 60 días)."
          checked={recall}
          onChange={setRecall}
          disponible={emailOperativo}
        />
        <Toggle
          icon={Mail}
          label="Resumen diario del dueño"
          detail="Cada mañana el dueño recibe por email el estado de caja, stock, lab y pendientes."
          checked={digest}
          onChange={setDigest}
          disponible={emailOperativo}
        />
        {!emailOperativo && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            El envío por email requiere activar el canal de correo (RESEND_API_KEY y un
            remitente verificado RESEND_FROM). Los toggles se guardan igualmente,
            pero los mensajes no saldrán hasta activarlo.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="plantilla-recordatorio"
            >
              Plantilla WhatsApp (recordatorio)
            </label>
            <Input
              id="plantilla-recordatorio"
              value={plantilla}
              onChange={(e) => setPlantilla(e.target.value)}
              placeholder="recordatorio_cita"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="idioma-plantilla">
              Idioma de la plantilla
            </label>
            <Input
              id="idioma-plantilla"
              value={idioma}
              onChange={(e) => setIdioma(e.target.value)}
              placeholder="es"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          La plantilla debe existir aprobada en WhatsApp Business Manager. Si el envío falla,
          se recurre al email automáticamente.
        </p>
      </CardContent>
    </Card>
  );
}

function Toggle({
  icon: Icon,
  label,
  detail,
  checked,
  onChange,
  disponible,
}: {
  icon: typeof Bell;
  label: string;
  detail: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disponible: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-xl border border-border-subtle bg-card p-3 text-left transition-colors hover:bg-surface-hover"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {checked && disponible ? (
            <Badge variant="green">
              <Mail className="size-3" /> Email
            </Badge>
          ) : checked ? (
            <Badge variant="amber">Configurar canal</Badge>
          ) : (
            <Badge variant="gray">Desactivado</Badge>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
      </span>
      <span
        className={`relative inline-flex size-5 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[2px]" : "translate-x-[-2px]"
          }`}
        />
      </span>
    </button>
  );
}
