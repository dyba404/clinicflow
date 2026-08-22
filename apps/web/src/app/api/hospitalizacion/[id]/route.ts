import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, admissions, bedAssignments, beds } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const TIPOS = ["emergencia", "observacion", "internamiento"] as const;
type Tipo = (typeof TIPOS)[number];

const ALTAS = ["medica", "voluntaria"] as const;
type Alta = (typeof ALTAS)[number];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("hospital.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    camaId?: string;
    motivoCama?: string;
    accion?: string;
    admision?: { motivo?: string; tipo?: string };
    alta?: { tipo?: string; epicrisis?: string };
    abandono?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const tieneCama = typeof body.camaId === "string";
  const tieneAlta = typeof body.alta !== "undefined";
  const tieneAbandono = Boolean(body.abandono);
  const tieneAdmision = typeof body.admision !== "undefined";
  const liberarCama = body.accion === "liberar_cama";
  if (!tieneCama && !tieneAlta && !tieneAbandono && !tieneAdmision && !liberarCama) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  if (tieneAdmision && body.admision) {
    const motivo = body.admision.motivo?.trim();
    if (typeof motivo !== "undefined" && motivo.length < 3) {
      return NextResponse.json({ error: "motivo_invalido" }, { status: 400 });
    }
    if (typeof body.admision.tipo !== "undefined" && !TIPOS.includes(body.admision.tipo as Tipo)) {
      return NextResponse.json({ error: "tipo_invalido" }, { status: 400 });
    }
  }
  if (tieneAlta && body.alta) {
    if (!ALTAS.includes(body.alta.tipo as Alta)) {
      return NextResponse.json({ error: "alta_tipo_invalido" }, { status: 400 });
    }
    if (!body.alta.epicrisis || body.alta.epicrisis.trim().length < 20) {
      return NextResponse.json({ error: "epicrisis_requerida" }, { status: 400 });
    }
  }

  const db = getDb();
  const [admision] = await db
    .select({
      id: admissions.id,
      estado: admissions.estado,
      motivo: admissions.motivo,
      tipo: admissions.tipo,
    })
    .from(admissions)
    .where(and(eq(admissions.id, id), eq(admissions.tenantId, g.team.id)))
    .limit(1);
  if (!admision) {
    return NextResponse.json({ error: "admision_no_encontrada" }, { status: 404 });
  }

  if (tieneCama || liberarCama) {
    if (admision.estado !== "activa") {
      return NextResponse.json({ error: "admision_no_activa" }, { status: 409 });
    }
  }

  if (tieneCama) {
    const camaId = body.camaId as string;
    const [cama] = await db
      .select({ id: beds.id, estado: beds.estado })
      .from(beds)
      .where(and(eq(beds.id, camaId), eq(beds.tenantId, g.team.id)))
      .limit(1);
    if (!cama) {
      return NextResponse.json({ error: "cama_no_encontrada" }, { status: 404 });
    }
    if (cama.estado !== "libre") {
      return NextResponse.json({ error: "cama_no_disponible" }, { status: 409 });
    }

    await db.transaction(async (tx) => {
      const previas = await tx
        .select({ id: bedAssignments.id, bedId: bedAssignments.bedId })
        .from(bedAssignments)
        .where(and(eq(bedAssignments.admissionId, id), isNull(bedAssignments.hasta)));
      if (previas.length > 0) {
        await tx
          .update(bedAssignments)
          .set({ hasta: new Date() })
          .where(and(eq(bedAssignments.admissionId, id), isNull(bedAssignments.hasta)));
        await tx
          .update(beds)
          .set({ estado: "limpieza" })
          .where(eq(beds.id, previas[0]!.bedId));
      }
      await tx.insert(bedAssignments).values({
        admissionId: id,
        bedId: camaId,
        motivo: body.motivoCama?.trim().slice(0, 200) || null,
      });
      await tx.update(beds).set({ estado: "ocupada" }).where(eq(beds.id, camaId));
    });

    void logAuditSesion({
      tenantId: g.team.id,
      accion: "hospitalizacion.cama",
      entidad: "bed_assignments",
      entidadId: id,
      payload: { camaId, motivo: body.motivoCama?.trim() ?? null },
    });
  }

  if (liberarCama) {
    const [actual] = await db
      .select({ id: bedAssignments.id, bedId: bedAssignments.bedId })
      .from(bedAssignments)
      .where(and(eq(bedAssignments.admissionId, id), isNull(bedAssignments.hasta)))
      .limit(1);
    if (!actual) {
      return NextResponse.json({ error: "cama_no_asignada" }, { status: 409 });
    }
    await db
      .update(bedAssignments)
      .set({ hasta: new Date() })
      .where(eq(bedAssignments.id, actual.id));
    await db.update(beds).set({ estado: "limpieza" }).where(eq(beds.id, actual.bedId));

    void logAuditSesion({
      tenantId: g.team.id,
      accion: "hospitalizacion.cama_liberar",
      entidad: "bed_assignments",
      entidadId: id,
      payload: { bedId: actual.bedId },
    });
  }

  if (tieneAdmision && body.admision) {
    if (admision.estado !== "activa") {
      return NextResponse.json({ error: "admision_no_activa" }, { status: 409 });
    }
    const cambios: { motivo?: string; tipo?: Tipo } = {};
    const motivo = body.admision.motivo?.trim();
    if (typeof motivo !== "undefined" && motivo.length >= 3 && motivo !== admision.motivo) {
      cambios.motivo = motivo;
    }
    if (typeof body.admision.tipo !== "undefined" && body.admision.tipo !== admision.tipo) {
      cambios.tipo = body.admision.tipo as Tipo;
    }
    if (Object.keys(cambios).length > 0) {
      await db
        .update(admissions)
        .set(cambios)
        .where(and(eq(admissions.id, id), eq(admissions.tenantId, g.team.id)));
      void logAuditSesion({
        tenantId: g.team.id,
        accion: "hospitalizacion.editar",
        entidad: "admissions",
        entidadId: id,
        payload: { campos: Object.keys(cambios) },
      });
    }
  }

  if (tieneAlta && body.alta) {
    if (admision.estado !== "activa") {
      return NextResponse.json({ error: "admision_no_activa" }, { status: 409 });
    }
    const altaTipo = body.alta.tipo as Alta;
    const epicrisis = body.alta.epicrisis!.trim();

    await db.transaction(async (tx) => {
      await tx
        .update(admissions)
        .set({
          estado: "egresada",
          dischargedAt: new Date(),
          altaTipo,
          epicrisis,
        })
        .where(and(eq(admissions.id, id), eq(admissions.tenantId, g.team.id)));
      const abiertas = await tx
        .select({ id: bedAssignments.id, bedId: bedAssignments.bedId })
        .from(bedAssignments)
        .where(and(eq(bedAssignments.admissionId, id), isNull(bedAssignments.hasta)));
      if (abiertas.length > 0) {
        await tx
          .update(bedAssignments)
          .set({ hasta: new Date() })
          .where(and(eq(bedAssignments.admissionId, id), isNull(bedAssignments.hasta)));
        await tx
          .update(beds)
          .set({ estado: "limpieza" })
          .where(eq(beds.id, abiertas[0]!.bedId));
      }
    });

    void logAuditSesion({
      tenantId: g.team.id,
      accion: "hospitalizacion.alta",
      entidad: "admissions",
      entidadId: id,
      payload: { tipo: altaTipo },
    });
  }

  if (tieneAbandono) {
    if (admision.estado !== "activa") {
      return NextResponse.json({ error: "admision_no_activa" }, { status: 409 });
    }
    await db.transaction(async (tx) => {
      await tx
        .update(admissions)
        .set({ estado: "abandono", dischargedAt: new Date() })
        .where(and(eq(admissions.id, id), eq(admissions.tenantId, g.team.id)));
      const abiertas = await tx
        .select({ bedId: bedAssignments.bedId })
        .from(bedAssignments)
        .where(and(eq(bedAssignments.admissionId, id), isNull(bedAssignments.hasta)));
      if (abiertas.length > 0) {
        await tx
          .update(bedAssignments)
          .set({ hasta: new Date() })
          .where(and(eq(bedAssignments.admissionId, id), isNull(bedAssignments.hasta)));
        await tx
          .update(beds)
          .set({ estado: "limpieza" })
          .where(eq(beds.id, abiertas[0]!.bedId));
      }
    });

    void logAuditSesion({
      tenantId: g.team.id,
      accion: "hospitalizacion.abandono",
      entidad: "admissions",
      entidadId: id,
    });
  }

  return NextResponse.json({ ok: true, id });
}
