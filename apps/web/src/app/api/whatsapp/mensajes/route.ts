import { NextResponse } from "next/server";
import { and, count, desc, eq } from "drizzle-orm";
import { getDb, whatsappMessages, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guardStaff("patients.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 50, 1), 200);
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;
  const direccion = url.searchParams.get("direccion");

  const condiciones = [eq(whatsappMessages.tenantId, g.team.id)];
  if (direccion === "in" || direccion === "out") {
    condiciones.push(eq(whatsappMessages.direction, direccion));
  }

  const db = getDb();
  const [filas, [totalRow]] = await Promise.all([
    db
      .select({
        id: whatsappMessages.id,
        waId: whatsappMessages.waId,
        direction: whatsappMessages.direction,
        patientId: whatsappMessages.patientId,
        patientNombre: patients.nombre,
        phoneNumber: whatsappMessages.phoneNumber,
        body: whatsappMessages.body,
        estado: whatsappMessages.estado,
        error: whatsappMessages.error,
        createdAt: whatsappMessages.createdAt,
      })
      .from(whatsappMessages)
      .leftJoin(patients, eq(whatsappMessages.patientId, patients.id))
      .where(and(...condiciones))
      .orderBy(desc(whatsappMessages.createdAt), desc(whatsappMessages.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(whatsappMessages).where(and(...condiciones)),
  ]);

  const total = totalRow?.total ?? 0;

  return NextResponse.json({
    mensajes: filas,
    total,
    limit,
    offset,
    siguienteOffset: offset + limit < total ? offset + limit : null,
  });
}
