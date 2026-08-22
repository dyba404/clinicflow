import { NextResponse } from "next/server";
import { and, eq, lte } from "drizzle-orm";
import { getDb, teams, quotes, patients, installments } from "@clinicflow/db";
import { appBaseUrl, mailConfigurado, sendMail } from "@/lib/mail";
import { plantillaPresupuestoSeguimiento } from "@/lib/notify";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const DIAS_PRIMERO = 3;
const DIAS_FINAL = 7;

function bearerValido(req: Request): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${esperado}`;
}

export async function POST(req: Request) {
  if (!bearerValido(req)) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  const db = getDb();
  const clinics = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug })
    .from(teams);

  let enviados = 0;
  let finales = 0;
  const hayMail = mailConfigurado();

  if (!hayMail) {
    for (const team of clinics) {
      void logAudit({
        tenantId: team.id,
        accion: "presupuesto.seguimiento_omitido",
        entidad: "quotes",
        payload: { motivo: "email_no_configurado" },
      });
    }
  } else {
    for (const team of clinics) {
      const envios = await db
        .select({
          id: quotes.id,
          patientId: quotes.patientId,
          titulo: quotes.titulo,
          total: quotes.total,
          enviadoA: quotes.updatedAt,
          seg1: quotes.seguimiento1At,
          seg2: quotes.seguimiento2At,
          pacienteNombre: patients.nombre,
          pacienteEmail: patients.email,
        })
        .from(quotes)
        .leftJoin(patients, eq(quotes.patientId, patients.id))
        .where(and(eq(quotes.tenantId, team.id), eq(quotes.estado, "enviado")));

      for (const q of envios) {
        if (!q.pacienteEmail || !q.pacienteNombre) continue;
        const desdeEnvio = Date.now() - new Date(q.enviadoA).getTime();
        const dias = desdeEnvio / (24 * 3600_000);

        if (dias >= DIAS_FINAL && !q.seg2) {
          const tpl = plantillaPresupuestoSeguimiento({
            clinicaNombre: team.name,
            clinicaSlug: team.slug,
            pacienteNombre: q.pacienteNombre,
            titulo: q.titulo,
            total: Number(q.total),
            esFinal: true,
            reservaUrl: `${appBaseUrl()}/${team.slug}/reserva`,
          });
          const r = await sendMail({
            to: q.pacienteEmail,
            subject: tpl.asunto,
            html: tpl.html,
            text: tpl.texto,
          });
          if (r.ok) {
            await db
              .update(quotes)
              .set({ seguimiento2At: new Date() })
              .where(eq(quotes.id, q.id));
            finales++;
          }
        } else if (dias >= DIAS_PRIMERO && !q.seg1 && !q.seg2) {
          const tpl = plantillaPresupuestoSeguimiento({
            clinicaNombre: team.name,
            clinicaSlug: team.slug,
            pacienteNombre: q.pacienteNombre,
            titulo: q.titulo,
            total: Number(q.total),
            esFinal: false,
            reservaUrl: `${appBaseUrl()}/${team.slug}/reserva`,
          });
          const r = await sendMail({
            to: q.pacienteEmail,
            subject: tpl.asunto,
            html: tpl.html,
            text: tpl.texto,
          });
          if (r.ok) {
            await db
              .update(quotes)
              .set({ seguimiento1At: new Date() })
              .where(eq(quotes.id, q.id));
            enviados++;
          }
        }
      }

      if (enviados > 0 || finales > 0) {
        void logAudit({
          tenantId: team.id,
          accion: "presupuesto.seguimiento_auto",
          entidad: "quotes",
          payload: { enviados, finales },
        });
      }
    }
  }

  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  const vencidas = await db
    .update(installments)
    .set({ estado: "vencida" })
    .where(
      and(
        eq(installments.estado, "pendiente"),
        lte(installments.vence, hoy),
      ),
    )
    .returning({ tenantId: installments.tenantId });

  return NextResponse.json({
    ok: true,
    seguimientos: enviados,
    finales,
    cuotasVencidas: vencidas.length,
    ...(hayMail ? {} : { omitido_seguimientos: "email_no_configurado" }),
  });
}
