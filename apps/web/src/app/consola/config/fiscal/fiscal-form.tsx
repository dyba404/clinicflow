"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";

export interface FiscalInicial {
  ruc: string | null;
  razonSocial: string | null;
  regimen: string;
  ambiente: string;
  usuarioSol: string | null;
  claveSolConfigurada: boolean;
  certificadoConfigurado: boolean;
  serieBoleta: string;
  serieFactura: string;
  corrBoleta: number;
  corrFactura: number;
  emision: string;
  emisionAuto: boolean;
}

function pemABase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const texto = String(reader.result);
      try {
        resolve(btoa(unescape(encodeURIComponent(texto))));
      } catch {
        reject(new Error("pem_invalido"));
      }
    };
    reader.onerror = () => reject(new Error("pem_invalido"));
    reader.readAsText(file);
  });
}

export function FiscalForm({
  inicial,
  masterKeyOk,
  lycetConfigurado,
  sidecarOk,
}: {
  inicial: FiscalInicial | null;
  masterKeyOk: boolean;
  lycetConfigurado: boolean;
  sidecarOk: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [ruc, setRuc] = useState(inicial?.ruc ?? "");
  const [razonSocial, setRazonSocial] = useState(inicial?.razonSocial ?? "");
  const [regimen, setRegimen] = useState(inicial?.regimen ?? "RUS");
  const [ambiente, setAmbiente] = useState(inicial?.ambiente ?? "beta");
  const [usuarioSol, setUsuarioSol] = useState(inicial?.usuarioSol ?? "");
  const [claveSol, setClaveSol] = useState("");
  const [certBase64, setCertBase64] = useState("");
  const [certNombre, setCertNombre] = useState("");
  const [emision, setEmision] = useState(inicial?.emision ?? "manual");
  const [emisionAuto, setEmisionAuto] = useState(inicial?.emisionAuto ?? false);

  function onPemSeleccionado(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El certificado no debe superar los 2 MB.");
      return;
    }
    void pemABase64(file)
      .then((b64) => {
        setCertBase64(b64);
        setCertNombre(file.name);
      })
      .catch(() => toast.error("No se pudo leer el archivo del certificado."));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!masterKeyOk) {
      toast.error("Define LOCAL_MASTER_KEY en .env.local para cifrar tus credenciales SUNAT.");
      return;
    }
    if (!/^\d{11}$/.test(ruc.trim())) {
      toast.error("El RUC debe tener exactamente 11 dígitos.");
      return;
    }
    if (razonSocial.trim().length < 2) {
      toast.error("Ingresa la razón social.");
      return;
    }
    if (!usuarioSol.trim()) {
      toast.error("Ingresa el usuario SOL (usuario secundario de SUNAT, ej. MODDATOS).");
      return;
    }
    start(async () => {
      const payload: Record<string, unknown> = {
        ruc: ruc.trim(),
        razonSocial: razonSocial.trim(),
        regimen,
        ambiente,
        emision,
        emisionAuto,
        usuarioSol: usuarioSol.trim(),
      };
      if (claveSol) payload.claveSol = claveSol;
      if (certBase64) payload.certificadoPemBase64 = certBase64;
      const res = await fetch("/api/vat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (j.error === "master_key_no_configurada") {
          toast.error("Define LOCAL_MASTER_KEY en .env.local para cifrar tus credenciales SUNAT.");
        } else if (j.error === "ruc_invalido") {
          toast.error("El RUC debe tener exactamente 11 dígitos.");
        } else {
          toast.error(`No se pudo guardar: ${j.error ?? "error"}`);
        }
        return;
      }
      toast.success("Configuración fiscal guardada.");
      setOpen(false);
      setClaveSol("");
      setCertBase64("");
      setCertNombre("");
      setTimeout(() => router.refresh(), 200);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Settings className="size-4" />
        Configurar facturación
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Facturación electrónica"
        icon={<Settings className="size-4 text-primary" />}
        description="Registra tus datos SUNAT para emitir boletas y facturas electrónicas."
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="fiscal-ruc">
                RUC
              </label>
              <Input
                id="fiscal-ruc"
                placeholder="20587421201"
                maxLength={11}
                value={ruc}
                onChange={(e) => setRuc(e.target.value.replace(/[^0-9]/g, ""))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="fiscal-razon">
                Razón social
              </label>
              <Input
                id="fiscal-razon"
                placeholder="Clínica Dental S.A.C."
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="fiscal-regimen">
                Régimen
              </label>
              <Select id="fiscal-regimen" value={regimen} onChange={(e) => setRegimen(e.target.value)}>
                <option value="RUS">Nuevo RUS</option>
                <option value="RER">Régimen Especial</option>
                <option value="MYPE">MYPE Tributario</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="fiscal-ambiente">
                Ambiente
              </label>
              <Select id="fiscal-ambiente" value={ambiente} onChange={(e) => setAmbiente(e.target.value)}>
                <option value="beta">Beta (SUNAT pruebas)</option>
                <option value="produccion">Producción</option>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="fiscal-usuariosol">
              Usuario SOL
            </label>
            <Input
              id="fiscal-usuariosol"
              placeholder="MODDATOS"
              value={usuarioSol}
              onChange={(e) => setUsuarioSol(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Usuario secundario de SUNAT (sin el RUC). Ejemplo: MODDATOS.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="fiscal-clave">
              Clave SOL{inicial?.claveSolConfigurada ? " (registrada — déjalo vacío para conservarla)" : ""}
            </label>
            <Input
              id="fiscal-clave"
              type="password"
              autoComplete="new-password"
              placeholder={inicial?.claveSolConfigurada ? "••••••••" : "Tu Clave SOL"}
              value={claveSol}
              onChange={(e) => setClaveSol(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="fiscal-pem">
              Certificado digital (PEM)
            </label>
            <Input
              id="fiscal-pem"
              type="file"
              accept=".pem,.crt,.cer,.txt"
              onChange={onPemSeleccionado}
            />
            <p className="text-xs text-muted-foreground">
              {certNombre
                ? `${certNombre} listo para guardar.`
                : inicial?.certificadoConfigurado
                  ? "Certificado cargado — sube uno nuevo solo si lo renovaste."
                  : "Certificado en formato PEM (clave privada + certificado). Si tienes un .pfx, conviértelo antes de cargarlo."}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="fiscal-emision">
              Modo de emisión
            </label>
            <Select id="fiscal-emision" value={emision} onChange={(e) => setEmision(e.target.value)}>
              <option value="manual">Manual (solo registro en caja)</option>
              <option value="electronica">Electrónica (envío a SUNAT)</option>
            </Select>
          </div>

          <label className="flex items-start gap-2.5" htmlFor="fiscal-emision-auto">
            <input
              id="fiscal-emision-auto"
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 rounded-sm border border-input accent-primary"
              checked={emisionAuto}
              onChange={(e) => setEmisionAuto(e.target.checked)}
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Emisión automática al cobrar.</span>{" "}
              Al registrar un pago en caja se emite una boleta electrónica (factura si el
              paciente tiene RUC). Si SUNAT o el sidecar fallan, el comprobante queda
              pendiente y el cron lo reintenta.
            </span>
          </label>

          {!masterKeyOk && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Falta LOCAL_MASTER_KEY en .env.local: sin ella no se pueden cifrar tu Clave SOL
              ni tu certificado. Defínela y reinicia el servidor.
            </p>
          )}
          {!lycetConfigurado || !sidecarOk ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {!lycetConfigurado
                ? "LYCET_URL no está definida: levanta el sidecar con docker compose up -d lycet para emitir."
                : "El sidecar Greenter/licet no responde. Levántalo con docker compose up -d lycet."}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Settings className="size-4" />}
              Guardar
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
