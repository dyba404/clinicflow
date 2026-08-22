import { expect, test } from "@playwright/test";
import { ROLES, contextConSesion, type Rol } from "./auth";

type Titulo = string | ((rol: Rol) => string | RegExp);

interface Ruta {
  ruta: string;
  titulo: Titulo;
  permitidos: Rol[];
}

const TODOS: Rol[] = ["owner", "receptionist", "assistant", "doctor"];

// Matriz derivada de packages/core/src/permissions.ts + gates en cada page.tsx.
// "permitidos" = roles cuya página NO muestra "Acceso restringido" / "Sin permiso".
const RUTAS: Ruta[] = [
  { ruta: "/consola", titulo: /Buen(os|as)\s(días|tardes|noches)/, permitidos: TODOS },
  { ruta: "/consola/agenda", titulo: (rol) => (rol === "doctor" ? "Mi agenda" : "Agenda"), permitidos: TODOS },
  { ruta: "/consola/sala-espera", titulo: "Sala de espera", permitidos: TODOS },
  { ruta: "/consola/solicitudes", titulo: "Solicitudes en línea", permitidos: TODOS },
  { ruta: "/consola/pacientes", titulo: "Pacientes", permitidos: TODOS },
  { ruta: "/consola/whatsapp", titulo: "WhatsApp", permitidos: TODOS }, // patients.manage: todos los roles
  { ruta: "/consola/lista-espera", titulo: "Lista de espera", permitidos: ["owner", "receptionist"] }, // waitlist.manage
  { ruta: "/consola/inventario", titulo: "Inventario", permitidos: ["owner", "assistant"] }, // inventory.manage
  { ruta: "/consola/aseguradoras", titulo: "Aseguradoras y EPS", permitidos: TODOS }, // sin gate (solo acción)
  { ruta: "/consola/caja", titulo: "Caja", permitidos: ["owner", "receptionist"] }, // payments.register
  { ruta: "/consola/cuotas", titulo: "Pagos por conciliar", permitidos: ["owner", "receptionist"] }, // payments.register
  { ruta: "/consola/caja/comprobantes", titulo: "Comprobantes", permitidos: ["owner", "receptionist"] }, // receipts.issue
  { ruta: "/consola/dashboard", titulo: "Ingresos", permitidos: ["owner"] }, // reports.view_all
  { ruta: "/consola/presupuestos", titulo: "Presupuestos", permitidos: ["owner", "receptionist", "doctor"] }, // quotes.manage
  { ruta: "/consola/comisiones", titulo: "Comisiones", permitidos: ["owner"] }, // commissions.manage
  { ruta: "/consola/recall", titulo: "Recall", permitidos: ["owner", "receptionist"] }, // reminders.send
  { ruta: "/consola/campanas", titulo: "Campañas", permitidos: ["owner", "receptionist"] }, // campaigns.manage
  { ruta: "/consola/reviews", titulo: "Reseñas de Google", permitidos: ["owner", "receptionist"] }, // reminders.send
  { ruta: "/consola/soporte", titulo: "Centro de ayuda", permitidos: TODOS },
  { ruta: "/consola/config/servicios", titulo: "Servicios", permitidos: TODOS }, // sin gate (solo acción)
  { ruta: "/consola/config/notificaciones", titulo: "Notificaciones", permitidos: ["owner"] }, // services.manage
  { ruta: "/consola/config/fiscal", titulo: "Facturación electrónica", permitidos: ["owner"] }, // vat.manage
  { ruta: "/consola/config/whatsapp", titulo: "WhatsApp Cloud API", permitidos: ["owner"] }, // services.manage
  { ruta: "/consola/config/suscripcion", titulo: "Suscripción", permitidos: ["owner"] }, // role === "owner"
  { ruta: "/consola/personal", titulo: "Personal", permitidos: ["owner"] }, // staff.manage
  { ruta: "/consola/sucursales", titulo: "Sucursales", permitidos: ["owner"] }, // branches.manage
  { ruta: "/consola/auditoria", titulo: "Auditoría", permitidos: ["owner"] }, // reports.view_all
  { ruta: "/consola/auditoria/fichas", titulo: "Historia vista por", permitidos: ["owner"] }, // reports.view_all
  { ruta: "/consola/arco", titulo: "ARCO (Ley 29733)", permitidos: ["owner"] }, // reports.view_all
  { ruta: "/consola/config/legal", titulo: "Cumplimiento legal", permitidos: ["owner"] }, // services.manage

  // OLA 2/3
  { ruta: "/consola/ordenes", titulo: "Órdenes", permitidos: ["owner", "assistant", "doctor"] }, // labs.manage
  { ruta: "/consola/hospitalizacion", titulo: "Hospitalización", permitidos: ["owner", "assistant", "doctor"] }, // hospital.manage
  { ruta: "/consola/quirofano", titulo: "Quirófano", permitidos: ["owner", "doctor"] }, // surgery.manage
  { ruta: "/consola/uci", titulo: "UCI", permitidos: ["owner", "doctor"] }, // icu.manage
  { ruta: "/consola/farmacia", titulo: "Farmacia", permitidos: TODOS }, // sin gate (solo acción)
  { ruta: "/consola/facturacion", titulo: "Facturación institucional", permitidos: ["owner", "receptionist"] }, // billing.manage

  // OLA 4
  { ruta: "/consola/direccion", titulo: "Dirección", permitidos: ["owner"] }, // reports.view_all
];

for (const rol of ROLES) {
  test(`RBAC ${rol}: matriz de acceso a la consola`, async ({ browser }) => {
    const context = await contextConSesion(browser, rol);
    const page = await context.newPage();

    for (const { ruta, titulo, permitidos } of RUTAS) {
      await test.step(`${rol} → ${ruta}`, async () => {
        await page.goto(ruta, { waitUntil: "domcontentloaded" });
        if (permitidos.includes(rol)) {
          await expect(page.getByText("Acceso restringido", { exact: true })).toHaveCount(0);
          await expect(page.getByText("Sin permiso", { exact: true })).toHaveCount(0);
          const t = typeof titulo === "function" ? titulo(rol) : titulo;
          await expect(page.getByRole("heading", { level: 2, name: t })).toBeVisible();
        } else {
          await expect(page.getByText(/Acceso restringido|Sin permiso/).first()).toBeVisible();
        }
      });
    }

    await context.close();
  });
}

test("sin sesión: la consola redirige a /login", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/consola", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login/);
  await context.close();
});
