import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { hasPermission, type StaffRole } from "@clinicflow/core";
import { getDb, users } from "@clinicflow/db";
import { ConsoleShell } from "@/components/console/shell";
import { UserMenu } from "@/components/console/user-menu";
import type { NavGroup } from "@/components/console/sidebar";
import { getSession, ROLE_INFO } from "@/lib/auth";
import {
  solicitudesActivas,
  citasDelDia,
  suscripcionTeam,
} from "@/lib/console-data";

export const dynamic = "force-dynamic";

export default async function ConsolaLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/primer-acceso");

  let impersonation: { adminEmail: string } | null = null;
  if (session.impersonatedByUserId) {
    const [admin] = await getDb()
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, session.impersonatedByUserId))
      .limit(1);
    impersonation = { adminEmail: admin?.email ?? "soporte de plataforma" };
  }

  const [solicitudes, citasHoy, sub] = await Promise.all([
    solicitudesActivas(session.teamId),
    citasDelDia(session.teamId, hoyLima()),
    suscripcionTeam(session.teamId),
  ]);

  const enSala = citasHoy.filter(
    (c) => c.estado === "en_espera" || c.estado === "confirmada",
  ).length;

  const groups = buildNav({
    citasHoy: citasHoy.length,
    enSala,
    solicitudes: solicitudes.length,
    role: session.role,
  });

  const planLabel =
    sub?.plan === "premium" ? "Premium" : sub?.plan === "pro" ? "Pro" : "Free";

  return (
    <ConsoleShell
      clinicName={session.teamName}
      clinicSlug={session.teamSlug}
      groups={groups}
      userName={session.name}
      userRole={ROLE_INFO[session.role].label}
      planLabel={planLabel}
      userMenu={<UserMenu userName={session.name} userRole={ROLE_INFO[session.role].label} />}
      impersonation={impersonation}
    >
      {children}
    </ConsoleShell>
  );
}

function buildNav({
  citasHoy,
  enSala,
  solicitudes,
  role,
}: {
  citasHoy: number;
  enSala: number;
  solicitudes: number;
  role: StaffRole;
}): NavGroup[] {
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(role, p);

  const operacion = [
    { href: "/consola", label: "Panel general", icon: "dashboard" },
    can("agenda.view_all") || can("agenda.view_own")
      ? {
          href: "/consola/agenda",
          label: role === "doctor" ? "Mi agenda" : "Agenda del día",
          icon: "agenda",
          badge: citasHoy || undefined,
        }
      : null,
    can("checkin.perform")
      ? {
          href: "/consola/sala-espera",
          label: "Sala de espera",
          icon: "espera",
          badge: enSala || undefined,
        }
      : null,
    can("appointments.edit") && solicitudes > 0
      ? {
          href: "/consola/solicitudes",
          label: "Solicitudes",
          icon: "solicitudes",
          badge: solicitudes,
        }
      : null,
    can("patients.manage")
      ? { href: "/consola/pacientes", label: "Pacientes", icon: "pacientes" }
      : null,
    can("patients.manage")
      ? { href: "/consola/whatsapp", label: "WhatsApp", icon: "whatsapp" }
      : null,
    can("waitlist.manage")
      ? { href: "/consola/lista-espera", label: "Lista de espera", icon: "listaespera" }
      : null,
    can("labs.manage")
      ? { href: "/consola/ordenes", label: "Órdenes", icon: "ordenes" }
      : null,
    can("hospital.manage")
      ? { href: "/consola/hospitalizacion", label: "Hospitalización", icon: "hospitalizacion" }
      : null,
    can("surgery.manage")
      ? { href: "/consola/quirofano", label: "Quirófano", icon: "quirofano" }
      : null,
    can("icu.manage")
      ? { href: "/consola/uci", label: "UCI", icon: "uci" }
      : null,
    can("inventory.manage")
      ? { href: "/consola/farmacia", label: "Farmacia", icon: "inventario" }
      : null,
    can("inventory.manage")
      ? { href: "/consola/inventario", label: "Inventario", icon: "inventario" }
      : null,
  ].filter((i): i is NonNullable<typeof i> => i !== null);

  const negociosHijos = [
    can("payments.register") ? { href: "/consola/caja", label: "Caja del día" } : null,
    can("billing.manage") ? { href: "/consola/facturacion", label: "Facturación" } : null,
    can("payments.register")
      ? { href: "/consola/cuotas", label: "Pagos por conciliar" }
      : null,
    can("receipts.issue")
      ? { href: "/consola/caja/comprobantes", label: "Comprobantes" }
      : null,
    can("reports.view_all") ? { href: "/consola/dashboard", label: "Ingresos" } : null,
    can("reports.view_all") ? { href: "/consola/direccion", label: "Dirección" } : null,
    can("quotes.manage") ? { href: "/consola/presupuestos", label: "Presupuestos" } : null,
    can("commissions.manage") ? { href: "/consola/comisiones", label: "Comisiones" } : null,
    can("reminders.send") ? { href: "/consola/recall", label: "Recall" } : null,
    can("campaigns.manage") ? { href: "/consola/campanas", label: "Campañas" } : null,
    can("reminders.send") ? { href: "/consola/reviews", label: "Reseñas Google" } : null,
  ].filter((i): i is NonNullable<typeof i> => i !== null);

  const configHijos = [
    can("services.manage") ? { href: "/consola/config/servicios", label: "Servicios" } : null,
    can("staff.manage") ? { href: "/consola/personal", label: "Personal" } : null,
    can("services.manage")
      ? { href: "/consola/config/notificaciones", label: "Notificaciones" }
      : null,
    can("vat.manage") ? { href: "/consola/config/fiscal", label: "Facturación" } : null,
    can("services.manage") ? { href: "/consola/config/whatsapp", label: "WhatsApp" } : null,
    can("insurers.manage") ? { href: "/consola/aseguradoras", label: "Aseguradoras" } : null,
    can("branches.manage") ? { href: "/consola/sucursales", label: "Sucursales" } : null,
    role === "owner"
      ? { href: "/consola/config/suscripcion", label: "Suscripción" }
      : null,
    can("reports.view_all") ? { href: "/consola/auditoria", label: "Auditoría" } : null,
    can("reports.view_all") ? { href: "/consola/auditoria/fichas", label: "Historia vista por" } : null,
    can("reports.view_all") ? { href: "/consola/arco", label: "ARCO (Ley 29733)" } : null,
    can("services.manage") ? { href: "/consola/config/legal", label: "Cumplimiento legal" } : null,
  ].filter((i): i is NonNullable<typeof i> => i !== null);

  const colapsable = (hijos: { href: string; label: string }[], icon: string, label: string) => {
    const primero = hijos[0];
    return hijos.length >= 2
      ? { label, icon, children: hijos }
      : primero && hijos.length === 1
        ? { href: primero.href, label: primero.label, icon }
        : null;
  };

  const negocio = colapsable(negociosHijos, "caja", "Negocios");
  const configuracion = colapsable(configHijos, "config", "Configuración");

  const groups: NavGroup[] = [{ title: "Operación", items: operacion }];
  if (negocio) groups.push({ title: "Administración", items: [negocio] });
  if (configuracion) groups.push({ title: "Clínica", items: [configuracion] });
  groups.push({
    title: "Soporte",
    items: [
      { href: "/consola/guia", label: "Guía de la app", icon: "soporte" },
      { href: "/consola/soporte", label: "Centro de ayuda", icon: "soporte" },
    ],
  });
  return groups;
}

function hoyLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}
