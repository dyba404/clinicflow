"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, KeyRound, MailCheck, ShieldQuestion, Unlock, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Miembro {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  lockedAt: string | null;
  isPlatformAdmin: boolean;
  ultimaSesion: string | null;
}

export function MemberActions({
  tenantId,
  miembro,
  onChanged,
}: {
  tenantId: string;
  miembro: Miembro;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(label: () => void) {
    start(label);
  }

  async function post(url: string, body?: unknown): Promise<Record<string, unknown> | null> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(`${j.error ?? "error"}`);
      return null;
    }
    onChanged();
    router.refresh();
    return j;
  }

  const bloqueado = Boolean(miembro.lockedAt);

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const j = await post("/api/admin/password-reset", { userId: miembro.userId });
            if (j) toast.success(`Recuperación enviada a ${miembro.email}`);
          })
        }
      >
        <MailCheck className="size-3.5" />
        Recuperación
      </Button>

      {!miembro.isPlatformAdmin &&
        (bloqueado ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const j = await post(`/api/admin/users/${miembro.userId}/unlock`);
                if (j) toast.success(`Usuario desbloqueado: ${miembro.email}`);
              })
            }
          >
            <Unlock className="size-3.5" />
            Desbloquear
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const reason = window.prompt(`Motivo del bloqueo de ${miembro.email}:`, "Soporte");
                if (reason === null) return;
                const j = await post(`/api/admin/users/${miembro.userId}/lock`, { reason });
                if (j) toast.success(`Usuario bloqueado: ${miembro.email}`);
              })
            }
          >
            <Ban className="size-3.5" />
            Bloquear
          </Button>
        ))}

      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const res = await fetch(`/api/admin/memberships/${miembro.membershipId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ active: !miembro.active }),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) {
              toast.error(`${j.error ?? "error"}`);
              return;
            }
            toast.success(
              miembro.active
                ? `Membresía desactivada: ${miembro.email}`
                : `Membresía activada: ${miembro.email}`,
            );
            onChanged();
            router.refresh();
          })
        }
      >
        <UserRoundX className="size-3.5" />
        {miembro.active ? "Desactivar" : "Activar"}
      </Button>

      {!miembro.isPlatformAdmin && !bloqueado && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const res = await fetch("/api/admin/impersonate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: miembro.userId, tenantId }),
              });
              const j = await res.json().catch(() => ({}));
              if (!res.ok || typeof j.url !== "string") {
                toast.error(`No se pudo impersonar: ${j.error ?? "error"}`);
                return;
              }
              window.location.assign(j.url);
            })
          }
        >
          <KeyRound className="size-3.5" />
          Impersonar
        </Button>
      )}

      {!miembro.isPlatformAdmin && bloqueado && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldQuestion className="size-3.5" />
          Bloqueado
        </span>
      )}
    </div>
  );
}
