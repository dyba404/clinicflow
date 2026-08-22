"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Eye, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImpersonationBanner({
  userName,
  teamName,
  adminEmail,
}: {
  userName: string;
  teamName: string;
  adminEmail: string;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-50 px-4 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
      <p className="flex min-w-0 items-center gap-2 text-xs sm:text-sm">
        <Eye className="size-4 shrink-0" aria-hidden />
        <span className="truncate">
          Operando como <strong>{userName}</strong> · {teamName} — vía {adminEmail}
        </span>
      </p>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 border-amber-500/50 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await fetch("/api/auth/end-impersonation", { method: "POST" });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) {
              toast.error(`No se pudo salir: ${j.error ?? "error"}`);
              return;
            }
            window.location.assign(j.adminRestored ? "/admin" : "/login");
          })
        }
      >
        <LogOut className="size-3.5" />
        {pending ? "Saliendo…" : "Salir"}
      </Button>
    </div>
  );
}
