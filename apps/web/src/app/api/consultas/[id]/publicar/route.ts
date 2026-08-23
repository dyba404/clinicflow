import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { hasPermission } from "@clinicflow/core";
import { getDb, consultations, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";
import { portalUrlFor } from "@/lib/magic-link";
import { enviarEmailConsultaPublicada } from "@/lib/notify";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff();
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { accion?: string; publicarNota?: boolean; motivo?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const accion = body.accion;
  if (accion !== "publicar" && accion !== "despublicar") {
    return NextResponse.json({ error: "accion_invalida" }, { status: 400 });
  }

  const db = getDb();
  const [consulta] = await db
    .select({
      id: consultations.id,
      creadoPor: consultations.creadoPor,
      publicadoAt: consultations.publicadoAt,
      patientId: consultations.patientId,
    })
    .from(consultations)
    .where(and(eq(consultations.id, id), eq(consultations.tenantId, g.team.id)))
    .limit(1);
  if (!consulta) {
    return NextResponse.json({ error: "consulta_no_encontrada" }, { status: 404 });
  }

  if (!hasPermission(g.membership.role, "records.edit") && consulta.creadoPor !== g.user.id) {
    return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
  }

  if (accion === "publicar") {
    if (consulta.publicadoAt) {
      return NextResponse.json({ error: "ya_publicada" }, { status: 409 });
    }
    await db
      .update(consultations)
      .set({
        publicadoAt: new Date(),
        publicadoPor: g.user.id,
        publicarNota: body.publicarNota ?? false,
        despublicadaMotivo: null,
        updatedAt: new Date(),
      })
      .where(eq(consultations.id, id));

    if (consulta.patientId) {
      const [paciente] = await db
        .select({ nombre: patients.nombre, email: patients.email })
        .from(patients)
        .where(eq(patients.id, consulta.patientId))
        .limit(1);
      if (paciente?.email) {
        const url = await portalUrlFor(g.team.id, consulta.patientId, g.team.slug);
        void enviarEmailConsultaPublicada({
          to: paciente.email,
          nombre: paciente.nombre.split(" ")[0] ?? paciente.nombre,
          clinicaNombre: g.team.name,
          portalUrl: url,
        });
      }
    }
  } else {
    if (!consulta.publicadoAt) {
      return NextResponse.json({ error: "no_publicada" }, { status: 409 });
    }
    const motivo = body.motivo?.trim();
    if (!motivo) {
      return NextResponse.json({ error: "falta_motivo" }, { status: 400 });
    }
    await db
      .update(consultations)
      .set({
        publicadoAt: null,
        publicadoPor: null,
        despublicadaMotivo: motivo,
        updatedAt: new Date(),
      })
      .where(eq(consultations.id, id));
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: accion === "publicar" ? "consulta.publicar" : "consulta.despublicar",
    entidad: "consultations",
    entidadId: id,
    payload: accion === "publicar" ? { publicarNota: body.publicarNota ?? false } : { motivo: body.motivo },
  });

  return NextResponse.json({ ok: true });
}
