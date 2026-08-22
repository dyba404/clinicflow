"use client";

import { useTransition, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function InvitarForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("receptionist");
  const [ultimoLink, setUltimoLink] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await fetch("/api/personal/invitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(
          j.error === "ya_es_miembro"
            ? "Esa persona ya es miembro del equipo"
            : `No se pudo invitar: ${j.error ?? "error"}`,
        );
        return;
      }
      const base = window.location.origin;
      const link = `${base}/invitaciones/${j.token}`;
      if (j.emailEnviado) {
        toast.success(`Invitación enviada a ${email}`);
      } else {
        setUltimoLink(link);
        await navigator.clipboard?.writeText(link).catch(() => undefined);
        toast.success("Invitación creada", {
          description: `Envío por email no disponible (${j.emailError ?? ""}). El enlace fue copiado: compártelo con ${email}.`,
        });
      }
      setEmail("");
      setTimeout(() => router.refresh(), 300);
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="inv-email">
            Correo
          </label>
          <Input
            id="inv-email"
            type="email"
            placeholder="correo@clinica.pe"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="w-40 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="inv-role">
            Rol
          </label>
          <Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="receptionist">Recepción</option>
            <option value="assistant">Asistente</option>
            <option value="doctor">Odontólogo</option>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          <Mail className="size-4" />
          Invitar
        </Button>
      </form>
      {ultimoLink ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Link2 className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate" title={ultimoLink}>
            {ultimoLink}
          </span>
          <button
            type="button"
            className="shrink-0 font-medium underline"
            onClick={() => {
              void navigator.clipboard?.writeText(ultimoLink).then(
                () => toast.success("Enlace copiado"),
                () => toast.error("No se pudo copiar"),
              );
            }}
          >
            Copiar
          </button>
        </div>
      ) : null}
    </div>
  );
}
