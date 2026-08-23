import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, patients, consentTemplates, consentSigns } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("records.view");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const rows = await getDb()
    .select({
      id: consentSigns.id,
      plantillaNombre: consentTemplates.nombre,
      tratamiento: consentSigns.tratamiento,
      firmanteNombre: consentSigns.firmanteNombre,
      firmanteRol: consentSigns.firmanteRol,
      signedAt: consentSigns.signedAt,
    })
    .from(consentSigns)
    .leftJoin(consentTemplates, eq(consentSigns.templateId, consentTemplates.id))
    .where(and(eq(consentSigns.patientId, id), eq(consentSigns.tenantId, g.team.id)))
    .orderBy(desc(consentSigns.signedAt))
    .limit(50);

  return NextResponse.json({ consentimientos: rows });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("records.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    templateId?: string;
    firmanteNombre?: string;
    firmanteRol?: string;
    signatureData?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const firmanteNombre = body.firmanteNombre?.trim();
  const signatureData = body.signatureData;
  if (!body.templateId || !firmanteNombre || !signatureData?.startsWith("data:image/png")) {
    return NextResponse.json({ error: "datos_requeridos" }, { status: 400 });
  }
  const firmanteRol = body.firmanteRol === "tutor" ? "tutor" : "paciente";

  const db = getDb();
  const [paciente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });

  const [tpl] = await db
    .select()
    .from(consentTemplates)
    .where(and(eq(consentTemplates.id, body.templateId), eq(consentTemplates.tenantId, g.team.id)))
    .limit(1);
  if (!tpl) return NextResponse.json({ error: "template_no_encontrado" }, { status: 404 });

  const signedAt = new Date();
  const signatureSha256 = createHash("sha256")
    .update(
      JSON.stringify({
        contenidoSnap: tpl.contenido,
        firmanteNombre,
        firmado: signedAt.toISOString(),
        tratamiento: tpl.tratamiento,
      }),
    )
    .digest("hex");

  const [row] = await db
    .insert(consentSigns)
    .values({
      tenantId: g.team.id,
      patientId: paciente.id,
      templateId: tpl.id,
      tratamiento: tpl.tratamiento,
      contenidoSnap: tpl.contenido,
      firmanteNombre,
      firmanteRol,
      signatureData,
      signatureSha256,
      ip: req.headers.get("x-forwarded-for") ?? "local",
      userAgent: req.headers.get("user-agent") ?? null,
      registradoPor: g.user.id,
      signedAt,
    })
    .returning({ id: consentSigns.id, signedAt: consentSigns.signedAt });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "consentimiento.firmar",
    entidad: "consent_signs",
    entidadId: row!.id,
    payload: { templateId: tpl.id, patientId: paciente.id, firmanteRol },
  });

  return NextResponse.json({ ok: true, consentimiento: row }, { status: 201 });
}
