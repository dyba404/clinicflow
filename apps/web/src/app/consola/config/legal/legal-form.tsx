"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, FileText, Save, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface LegalInicial {
  razonSocial: string | null;
  ruc: string | null;
  direccionLegal: string | null;
  emailContactoDatos: string | null;
  telefonoContactoDatos: string | null;
  politicaPrivacidad: string | null;
  terminosUso: string | null;
  textoConsentimiento: string | null;
}

const ERRORES: Record<string, string> = {
  ruc_invalido: "El RUC debe tener exactamente 11 dígitos.",
  email_invalido: "El correo de contacto de datos no es válido.",
  texto_demasiado_largo: "Uno de los textos excede los 10 000 caracteres.",
};

export function LegalForm({ inicial, slug }: { inicial: LegalInicial; slug: string }) {
  const router = useRouter();
  const [razonSocial, setRazonSocial] = useState(inicial.razonSocial ?? "");
  const [ruc, setRuc] = useState(inicial.ruc ?? "");
  const [direccion, setDireccion] = useState(inicial.direccionLegal ?? "");
  const [email, setEmail] = useState(inicial.emailContactoDatos ?? "");
  const [telefono, setTelefono] = useState(inicial.telefonoContactoDatos ?? "");
  const [politica, setPolitica] = useState(inicial.politicaPrivacidad ?? "");
  const [terminos, setTerminos] = useState(inicial.terminosUso ?? "");
  const [consentimiento, setConsentimiento] = useState(inicial.textoConsentimiento ?? "");
  const [saving, setSaving] = useState(false);

  async function guardar(generarPlantillas: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/config/legal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razonSocial: razonSocial || null,
          ruc: ruc || null,
          direccionLegal: direccion || null,
          emailContactoDatos: email || null,
          telefonoContactoDatos: telefono || null,
          politicaPrivacidad: politica || null,
          terminosUso: terminos || null,
          textoConsentimiento: consentimiento || null,
          generarPlantillas,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(ERRORES[data?.error ?? ""] ?? data?.message ?? "No se pudo guardar.");
        return;
      }
      if (generarPlantillas && data) {
        setPolitica(data.politicaPrivacidad ?? politica);
        setTerminos(data.terminosUso ?? terminos);
        setConsentimiento(data.textoConsentimiento ?? consentimiento);
        toast.success("Textos generados y guardados con tus datos legales.");
      } else {
        toast.success("Configuración legal guardada.");
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
          <CardTitle className="text-sm font-medium">Datos del responsable</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => guardar(true)} disabled={saving}>
              <Sparkles className="mr-1 size-3.5" />
              Generar textos con mis datos
            </Button>
            <Button size="sm" onClick={() => guardar(false)} disabled={saving}>
              <Save className="mr-1 size-3.5" />
              Guardar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 pt-0 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="razon-social">Razón social</Label>
            <Input
              id="razon-social"
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              placeholder="Ej. Clínica Dental Sonrisa S.A.C."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ruc">RUC</Label>
            <Input
              id="ruc"
              value={ruc}
              inputMode="numeric"
              maxLength={11}
              onChange={(e) => setRuc(e.target.value.replace(/\D/g, ""))}
              placeholder="20123456789"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="direccion">Domicilio legal</Label>
            <Input
              id="direccion"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Av. Ejemplo 123, Lima"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-datos">Correo de contacto (Ley 29733)</Label>
            <Input
              id="email-datos"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="datos@tuclinica.com"
            />
            <p className="text-xs text-muted-foreground">
              Aquí recibirás las solicitudes ARCO y consultas sobre datos personales.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefono-datos">Teléfono de contacto</Label>
            <Input
              id="telefono-datos"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+51 999 999 999"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText className="size-4 text-muted-foreground" />
            Textos publicados en tu página pública
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Si dejas un texto vacío, se muestra la plantilla legal con los datos de arriba.
            Puedes reemplazarla por la versión que te indique tu asesor legal.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="politica">Política de privacidad (Ley 29733)</Label>
              <a
                href={`/${slug}/privacidad`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Vista previa <ExternalLink className="size-3" />
              </a>
            </div>
            <Textarea
              id="politica"
              rows={8}
              value={politica}
              onChange={(e) => setPolitica(e.target.value)}
              placeholder="Vacío = plantilla generada con tus datos legales"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="terminos">Términos de uso</Label>
              <a
                href={`/${slug}/terminos`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Vista previa <ExternalLink className="size-3" />
              </a>
            </div>
            <Textarea
              id="terminos"
              rows={8}
              value={terminos}
              onChange={(e) => setTerminos(e.target.value)}
              placeholder="Vacío = plantilla generada con tus datos legales"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="consentimiento">Texto del consentimiento (wizard de reservas)</Label>
            <Textarea
              id="consentimiento"
              rows={3}
              value={consentimiento}
              onChange={(e) => setConsentimiento(e.target.value)}
              placeholder="Vacío = plantilla estándar de consentimiento"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
