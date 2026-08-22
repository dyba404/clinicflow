import { and, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import {
  getDb,
  payments,
  cashClosures,
  inventoryItems,
  inventoryLots,
  orders,
  patients,
  quotes,
  installments,
  subscriptions,
  memberships,
  users,
} from "@clinicflow/db";
import { appBaseUrl } from "@/lib/mail";

export interface SeccionDigest {
  titulo: string;
  detalle: string;
}

export interface DigestEquipo {
  secciones: SeccionDigest[];
  totalPendientes: number;
}

function fechaLocal(timezone: string, dias: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
    new Date(Date.now() + dias * 24 * 3600_000),
  );
}

export async function emailOwner(tenantId: string): Promise<string | null> {
  const [fila] = await getDb()
    .select({ email: users.email })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(memberships.teamId, tenantId), eq(memberships.role, "owner"), eq(memberships.active, true)))
    .limit(1);
  return fila?.email ?? null;
}

export async function computarDigest(opts: {
  tenantId: string;
  timezone: string;
}): Promise<DigestEquipo> {
  const db = getDb();
  const t = opts.tenantId;
  const secciones: SeccionDigest[] = [];
  let totalPendientes = 0;

  const ayer = fechaLocal(opts.timezone, -1);
  const inicioAyer = new Date(`${ayer}T00:00:00`);
  const finAyer = new Date(`${ayer}T23:59:59`);
  const pagosAyer = await db
    .select({ total: sql<number>`coalesce(sum(${payments.monto}::numeric), 0)`, n: sql<number>`count(*)` })
    .from(payments)
    .where(and(eq(payments.tenantId, t), gte(payments.createdAt, inicioAyer), lte(payments.createdAt, finAyer)));
  const montoAyer = Number(pagosAyer[0]?.total ?? 0);
  const [cierre] = await db
    .select({ id: cashClosures.id })
    .from(cashClosures)
    .where(and(eq(cashClosures.tenantId, t), eq(cashClosures.fecha, ayer)))
    .limit(1);
  if (montoAyer > 0 && !cierre) {
    secciones.push({
      titulo: "Caja de ayer sin cerrar",
      detalle: `Ayer se registraron pagos por S/ ${montoAyer.toFixed(2)} y la caja aún no se cerró.`,
    });
    totalPendientes++;
  }

  const stockBajo = await db
    .select({ nombre: inventoryItems.nombre, stock: inventoryItems.stock, stockMin: inventoryItems.stockMin })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.tenantId, t), eq(inventoryItems.activo, true)))
    .then((rows) => rows.filter((r) => Number(r.stock) <= Number(r.stockMin)));
  if (stockBajo.length > 0) {
    secciones.push({
      titulo: "Stock bajo",
      detalle: `${stockBajo.length} ítem(s) en o bajo el mínimo: ${stockBajo.slice(0, 5).map((r) => `${r.nombre} (${r.stock})`).join(", ")}${stockBajo.length > 5 ? "…" : ""}.`,
    });
    totalPendientes++;
  }

  const proximos30 = fechaLocal(opts.timezone, 30);
  const hoy = fechaLocal(opts.timezone, 0);
  const lotesPorVencer = await db
    .select({ lote: inventoryLots.lote, vence: inventoryLots.vence, nombre: inventoryItems.nombre })
    .from(inventoryLots)
    .innerJoin(inventoryItems, eq(inventoryLots.itemId, inventoryItems.id))
    .where(
      and(
        eq(inventoryItems.tenantId, t),
        isNotNull(inventoryLots.vence),
        gte(inventoryLots.vence, hoy),
        lte(inventoryLots.vence, proximos30),
      ),
    );
  if (lotesPorVencer.length > 0) {
    secciones.push({
      titulo: "Lotes por vencer (30 días)",
      detalle: `${lotesPorVencer.length} lote(s): ${lotesPorVencer.slice(0, 5).map((r) => `${r.nombre} L${r.lote} (${r.vence})`).join(", ")}${lotesPorVencer.length > 5 ? "…" : ""}.`,
    });
    totalPendientes++;
  }

  const limiteOrdenes = new Date(Date.now() - 3 * 24 * 3600_000);
  const ordenesPendientes = await db
    .select({ nombre: orders.nombre, paciente: patients.nombre })
    .from(orders)
    .innerJoin(patients, eq(orders.patientId, patients.id))
    .where(
      and(
        eq(orders.tenantId, t),
        inArray(orders.estado, ["toma", "procesada"]),
        lte(orders.createdAt, limiteOrdenes),
      ),
    )
    .limit(20);
  if (ordenesPendientes.length > 0) {
    secciones.push({
      titulo: "Órdenes pendientes de completar",
      detalle: `${ordenesPendientes.length} orden(es) con más de 3 días: ${ordenesPendientes.slice(0, 5).map((r) => `${r.nombre} (${r.paciente})`).join(", ")}${ordenesPendientes.length > 5 ? "…" : ""}.`,
    });
    totalPendientes++;
  }

  const sinRespuesta = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(and(eq(quotes.tenantId, t), eq(quotes.estado, "enviado")));
  if (sinRespuesta.length > 0) {
    secciones.push({
      titulo: "Presupuestos sin respuesta",
      detalle: `${sinRespuesta.length} presupuesto(s) enviados a la espera de respuesta.`,
    });
    totalPendientes++;
  }

  const cuotasVencidas = await db
    .select({ id: installments.id })
    .from(installments)
    .where(and(eq(installments.tenantId, t), eq(installments.estado, "vencida")));
  if (cuotasVencidas.length > 0) {
    secciones.push({
      titulo: "Cuotas vencidas",
      detalle: `${cuotasVencidas.length} cuota(s) vencidas por cobrar.`,
    });
    totalPendientes++;
  }

  const [sub] = await db
    .select({ estado: subscriptions.estado, vence: subscriptions.vence })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, t))
    .limit(1);
  if (sub && sub.estado === "por_renovar" && sub.vence) {
    secciones.push({
      titulo: "Plan por renovar",
      detalle: `Tu plan de Clinicflow vence el ${sub.vence}. Renueva en ${appBaseUrl()}/consola/config/suscripcion.`,
    });
    totalPendientes++;
  }

  return { secciones, totalPendientes };
}

export function plantillaDigest(opts: {
  clinicaNombre: string;
  fecha: string;
  secciones: SeccionDigest[];
}): { asunto: string; html: string; texto: string } {
  const filas = opts.secciones
    .map(
      (s) =>
        `<tr><td style="padding:10px 0;vertical-align:top;"><strong style="color:#111827;">${s.titulo}</strong><br /><span style="color:#6b7280;font-size:13px;">${s.detalle}</span></td></tr>`,
    )
    .join("");
  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f6f5f3;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f3;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0d9488;padding:20px 32px;">
          <p style="margin:0;color:#ffffff;font-size:16px;font-weight:bold;">Resumen diario · ${opts.clinicaNombre}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:18px;color:#1f2937;">${opts.fecha}</h1>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5;">${filas}</table>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Resumen generado automáticamente por Clinicflow.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const texto = `Resumen diario · ${opts.clinicaNombre} · ${opts.fecha}\n\n${opts.secciones
    .map((s) => `• ${s.titulo}: ${s.detalle}`)
    .join("\n")}`;
  return {
    asunto: `Resumen diario — ${opts.fecha} | ${opts.clinicaNombre}`,
    html,
    texto,
  };
}
