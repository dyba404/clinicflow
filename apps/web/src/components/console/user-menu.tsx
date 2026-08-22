"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function UserMenu({ userName, userRole }: { userName: string; userRole: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function salir() {
    start(async () => {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <div className="px-3 py-3">
      <button
        type="button"
        onClick={salir}
        disabled={pending}
        className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground/60 transition-colors duration-150 hover:bg-sidebar-accent/70 hover:text-white disabled:opacity-60"
      >
        <LogOut className="size-4" />
        <span>Cerrar sesión</span>
      </button>
      <p className="mt-1 px-2 text-[10px] text-sidebar-foreground/40">
        Sesión de {userName} · {userRole}
      </p>
    </div>
  );
}
