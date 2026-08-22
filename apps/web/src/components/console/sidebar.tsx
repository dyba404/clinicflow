"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  Users,
  Wallet,
  HeartPulse,
  ExternalLink,
  Stethoscope,
  Bell,
  CreditCard,
  LifeBuoy,
  Settings,
  ShieldCheck,
  Receipt,
  ChartColumn,
  AlarmClock,
  FileText,
  Boxes,
  FileSpreadsheet,
  HandCoins,
  Megaphone,
  Star,
  Hourglass,
  ShieldPlus,
  MapPin,
  MessageCircle,
  FlaskConical,
  BedDouble,
  Activity,
  Scissors,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavChild {
  href: string;
  label: string;
  badge?: number;
}

export interface NavItem {
  href?: string;
  label: string;
  icon?: string;
  badge?: number;
  children?: NavChild[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  agenda: CalendarDays,
  solicitudes: ClipboardList,
  pacientes: Users,
  espera: Inbox,
  caja: Wallet,
  ingresos: ChartColumn,
  personal: HeartPulse,
  servicios: Stethoscope,
  notificaciones: Bell,
  suscripcion: CreditCard,
  soporte: LifeBuoy,
  config: Settings,
  comprobantes: Receipt,
  recall: AlarmClock,
  auditoria: ShieldCheck,
  historial: FileText,
  inventario: Boxes,
  presupuestos: FileSpreadsheet,
  comisiones: HandCoins,
  campanas: Megaphone,
  reviews: Star,
  listaespera: Hourglass,
  aseguradoras: ShieldPlus,
  sucursales: MapPin,
  whatsapp: MessageCircle,
  ordenes: FlaskConical,
  hospitalizacion: BedDouble,
  signos: Activity,
  quirofano: Scissors,
  uci: HeartPulse,
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/consola" && pathname.startsWith(href));
}

function storageKey(href: string) {
  return `of-nav-open-${href}`;
}

function Collapsible({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const id = item.children?.[0]?.href ?? item.label;
  const childActive = item.children?.some((c) =>
    isActivePath(pathname, c.href),
  );
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey(id));
      if (stored !== null) setOpen(stored === "1");
    } catch {
      return;
    }
  }, [id]);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  const toggle = () => {
    setOpen((v) => {
      try {
        sessionStorage.setItem(storageKey(id), v ? "0" : "1");
      } catch {
        void 0;
      }
      return !v;
    });
  };

  const Icon = item.icon ? ICONS[item.icon] : undefined;

  return (
    <li>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          "group flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-sm text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-white",
          childActive && !open && "text-white",
        )}
      >
        {Icon ? (
          <Icon className="size-4 shrink-0 text-sidebar-foreground/60 transition-colors group-hover:text-white" />
        ) : null}
        <span className="flex-1 text-left">{item.label}</span>
        {item.badge ? (
          <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-300">
            {item.badge}
          </span>
        ) : null}
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <ul className="overflow-hidden">
          <li className="ml-[1.125rem] border-l border-sidebar-border pl-2 py-1">
            <ul className="space-y-0.5">
              {item.children?.map((child) => {
                const active = isActivePath(pathname, child.href);
                return (
                  <li key={child.href}>
                    <Link
                      href={child.href}
                      className={cn(
                        "flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] text-sidebar-foreground/60 transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-white",
                        active &&
                          "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                      )}
                    >
                      <span className="flex-1 truncate">{child.label}</span>
                      {child.badge ? (
                        <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-300">
                          {child.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        </ul>
      </div>
    </li>
  );
}

export function ConsoleSidebar({
  clinicName,
  clinicSlug,
  groups,
  userName,
  userRole,
  planLabel,
  userMenu,
}: {
  clinicName: string;
  clinicSlug: string;
  groups: NavGroup[];
  userName: string;
  userRole: string;
  planLabel: string;
  userMenu?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          O
        </span>
        <span className="text-sm font-semibold tracking-tight text-white">clinicflow</span>
      </div>

      <div className="border-b border-sidebar-border px-3 py-3">
        <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
          <p className="truncate text-sm font-medium text-white">{clinicName}</p>
          <p className="text-[11px] text-sidebar-foreground/60">Plan {planLabel}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {groups.map((g) => (
          <div key={g.title} className="mb-4">
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {g.title}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((item) =>
                item.children && item.children.length > 0 ? (
                  <Collapsible key={item.label} item={item} pathname={pathname} />
                ) : (
                  <li key={item.href}>
                    <Link
                      href={item.href ?? "/consola"}
                      className={cn(
                        "group flex h-9 items-center gap-2.5 rounded-lg px-2 text-sm text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-white",
                        item.href &&
                          isActivePath(pathname, item.href) &&
                          "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                      )}
                    >
                      {item.icon && ICONS[item.icon] ? (
                        (() => {
                          const Icon = ICONS[item.icon as string];
                          if (!Icon) return null;
                          return (
                            <Icon
                              className={cn(
                                "size-4 shrink-0 text-sidebar-foreground/60 transition-colors group-hover:text-white",
                                item.href &&
                                  isActivePath(pathname, item.href) &&
                                  "text-white",
                              )}
                            />
                          );
                        })()
                      ) : null}
                      <span className="flex-1">{item.label}</span>
                      {item.badge ? (
                        <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-300">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}

        <a
          href={`/${clinicSlug}/reserva`}
          target="_blank"
          rel="noreferrer"
          className="flex h-9 items-center gap-2.5 rounded-lg border border-sidebar-border/60 px-2 text-sm text-sidebar-foreground/60 transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-white"
        >
          <ExternalLink className="size-4 shrink-0" />
          <span className="flex-1">Página pública de reservas</span>
        </a>
      </nav>

      <div className="border-t border-sidebar-border">
        {userMenu}
        <div className="flex items-center gap-2.5 border-t border-sidebar-border p-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {userName
              .trim()
              .split(/\s+/)
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{userName}</p>
            <p className="text-[11px] text-sidebar-foreground/60">{userRole}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
