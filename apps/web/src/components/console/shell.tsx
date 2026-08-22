"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { ConsoleSidebar, type NavGroup } from "@/components/console/sidebar";
import { CommandPalette } from "@/components/console/command-palette";
import { ImpersonationBanner } from "@/components/console/impersonation-banner";
import { cn } from "@/lib/utils";

export function ConsoleShell({
  clinicName,
  clinicSlug,
  groups,
  userName,
  userRole,
  planLabel,
  userMenu,
  impersonation,
  children,
}: {
  clinicName: string;
  clinicSlug: string;
  groups: NavGroup[];
  userName: string;
  userRole: string;
  planLabel: string;
  userMenu?: React.ReactNode;
  impersonation?: { adminEmail: string } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-background pt-[env(safe-area-inset-top)] text-foreground">
      <ConsoleSidebar
        clinicName={clinicName}
        clinicSlug={clinicSlug}
        groups={groups}
        userName={userName}
        userRole={userRole}
        planLabel={planLabel}
        userMenu={userMenu}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-medium">{clinicName}</p>
            <span className="hidden rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground sm:inline-block">
              Plan {planLabel}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [@media(pointer:coarse)]:min-h-12"
            >
              <Search className="size-4" />
              <span className="hidden md:inline">Buscar…</span>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                Ctrl K
              </kbd>
            </button>
            <span className="hidden rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground sm:inline-block">
              {new Intl.DateTimeFormat("es-PE", {
                weekday: "short",
                day: "numeric",
                month: "short",
              }).format(new Date())}
            </span>
          </div>
        </header>

        {impersonation && (
          <ImpersonationBanner
            userName={userName}
            teamName={clinicName}
            adminEmail={impersonation.adminEmail}
          />
        )}

        <nav className="flex gap-1 overflow-x-auto border-b bg-background/80 px-3 py-2 lg:hidden [@media(pointer:coarse)]:py-2.5">
          {groups
            .flatMap((g) => g.items)
            .flatMap((item) =>
              item.children && item.children.length > 0
                ? item.children.map((c) => ({ href: c.href, label: c.label, badge: c.badge }))
                : [{ href: item.href ?? "/consola", label: item.label, badge: item.badge }],
            )
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-md px-2.5 py-1 text-sm text-muted-foreground [@media(pointer:coarse)]:min-h-12 [@media(pointer:coarse)]:inline-flex [@media(pointer:coarse)]:items-center [@media(pointer:coarse)]:px-3",
                  (pathname === item.href ||
                    (item.href !== "/consola" && pathname.startsWith(item.href))) &&
                    "bg-accent font-medium text-accent-foreground",
                )}
              >
                {item.label}
                {item.badge ? ` (${item.badge})` : ""}
              </Link>
            ))}
        </nav>

        <main className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
