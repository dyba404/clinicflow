import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, surgeries } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ESTADOS = ["programada", "intra", "urpa", "completada", "cancelada"] as const;
type Estado = (typeof ESTADOS)[number];

const CHECKLIST_LABELS = [
  "Identidad del paciente confirmada",
  "Consentimiento informado firmado",
  "Sitio quirúrgico marcado",
  "Profilaxis antibiótica",
  "Ayuno mínimo 8 horas",
  "Equipo completo asignado",
] as const;

function checklistCompleto(checklistPreop: unknown): boolean {
  if (!Array.isArray(checklistPreop) || checklistPreop.length !== CHECKLIST_LABELS.length) {
    return false;
  }
  return checklistPreop.every((v) => v === true);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("surgery.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    estado?: string;
    checklistPreop?: unknown[];
    complicaciones?: string;
    equipo?: unknown;
    urpaNotas?: string;
    canceladaMotivo?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [actual] = await db
    .select({
      id: surgeries.id,
      estado: surgeries.estado,
      checklistPreop: surgeries.checklistPreop,
    })
    .from(surgeries)
    .where(and(eq(surgeries.id, id), eq(surgeries.tenantId, g.team.id)))
    .limit(1);
  if (!actual) {
    return NextResponse.json({ error: "cirugia_no_encontrada" }, { status: 404 });
  }

  const actualEstado = actual.estado as Estado;

  const soloChecklist =
    typeof body.checklistPreop !== "undefined" && typeof body.estado === "undefined";
  if (soloChecklist) {
    if (actualEstado !== "programada") {
      return NextResponse.json({ error: "transicion_invalida" }, { status: 409 });
    }
    const kl = body.checklistPreop;
    if (!Array.isArray(kl) || kl.length !== CHECKLIST_LABELS.length || kl.some((v) => typeof v !== "boolean")) {
      return NextResponse.json({ error: "checklist_invalido" }, { status: 400 });
    }
    const [row] = await db
      .update(surgeries)
      .set({ checklistPreop: kl, updatedAt: new Date() })
      .where(and(eq(surgeries.id, id), eq(surgeries.tenantId, g.team.id)))
      .returning({ id: surgeries.id, estado: surgeries.estado });

    void logAuditSesion({
      tenantId: g.team.id,
      accion: "cirugia.checklist",
      entidad: "surgeries",
      entidadId: id,
      payload: { checklistPreop: kl },
    });

    return NextResponse.json({ ok: true, id: row!.id, estado: row!.estado });
  }

  const estado = body.estado as Estado | undefined;
  if (!estado || !ESTADOS.includes(estado)) {
    return NextResponse.json({ error: "estado_invalido" }, { status: 400 });
  }
  if (estado === actualEstado) {
    return NextResponse.json({ error: "transicion_invalida" }, { status: 409 });
  }

  const cambios: Partial<typeof surgeries.$inferInsert> = { updatedAt: new Date() };

  if (estado === "cancelada") {
    if (actualEstado === "completada") {
      return NextResponse.json({ error: "transicion_invalida" }, { status: 409 });
    }
    const motivo = body.canceladaMotivo?.trim() ?? "";
    if (motivo.length < 3) {
      return NextResponse.json({ error: "motivo_requerido" }, { status: 400 });
    }
    cambios.estado = estado;
    cambios.canceladaMotivo = motivo.slice(0, 500);
  } else if (actualEstado === "programada" && estado === "intra") {
    if (!checklistCompleto(actual.checklistPreop)) {
      return NextResponse.json({ error: "checklist_incompleto" }, { status: 400 });
    }
    cambios.estado = estado;
    cambios.inicioAt = new Date();
  } else if (actualEstado === "intra" && estado === "urpa") {
    cambios.estado = estado;
    cambios.finAt = new Date();
    if (typeof body.complicaciones === "string" && body.complicaciones.trim()) {
      cambios.complicaciones = body.complicaciones.trim().slice(0, 1000);
    }
    if (typeof body.equipo !== "undefined" && body.equipo !== null) {
      cambios.equipo = body.equipo;
    }
  } else if (actualEstado === "urpa" && estado === "completada") {
    const notas = body.urpaNotas?.trim() ?? "";
    if (notas.length < 10) {
      return NextResponse.json({ error: "notas_urpa_requeridas" }, { status: 400 });
    }
    cambios.estado = estado;
    cambios.urpaNotas = notas.slice(0, 2000);
  } else {
    return NextResponse.json({ error: "transicion_invalida" }, { status: 409 });
  }

  const [row] = await db
    .update(surgeries)
    .set(cambios)
    .where(and(eq(surgeries.id, id), eq(surgeries.tenantId, g.team.id)))
    .returning({ id: surgeries.id, estado: surgeries.estado });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "cirugia.estado",
    entidad: "surgeries",
    entidadId: id,
    payload: { estado, de: actualEstado },
  });

  return NextResponse.json({ ok: true, id: row!.id, estado: row!.estado });
}
