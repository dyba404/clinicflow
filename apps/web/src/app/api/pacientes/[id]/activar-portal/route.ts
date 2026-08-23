import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, patients, patientMagicTokens } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { randomHex } from "@/lib/audit";
import { appBaseUrl } from "@/lib/mail";
import { notificarPaciente } from "@/lib/notificar-paciente";
import { enviarEmailActivacionPortal } from "@/lib/notify";
import { logAuditSesion } from "@/lib/audit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardStaff("patients.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const { id } = await params;
  const db = getDb();

  const [paciente] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) {
    return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
  }

  if (paciente.passwordHash) {
    return NextResponse.json({ error: "portal_ya_activo" }, { status: 409 });
  }

  const token = randomHex(24);
  await db.insert(patientMagicTokens).values({
    tenantId: g.team.id,
    patientId: paciente.id,
    appointmentId: null,
    token,
    tipo: "activacion",
    expiresAt: new Date(Date.now() + 3600_000),
  });

  const activacionUrl = `${appBaseUrl()}/${g.team.slug}/portal/activar/${token}`;
  const primerNombre = paciente.nombre.split(" ")[0] ?? paciente.nombre;

  let enviado: { ok: boolean; canal: string };
  if (paciente.email) {
    const r = await enviarEmailActivacionPortal({
      to: paciente.email,
      nombre: primerNombre,
      clinicaNombre: g.team.name,
      activacionUrl,
    });
    enviado = { ok: r.ok, canal: "email" };
  } else {
    enviado = { ok: false, canal: "ninguno" };
  }

  if (!enviado.ok) {
    const r = await notificarPaciente({
      tenantId: g.team.id,
      celular: paciente.celular,
      email: null,
      mensajeWhatsApp: `Hola ${primerNombre}, ${g.team.name} activó tu portal de paciente. Crea tu contraseña aquí: ${activacionUrl} (vence en 1 hora)`,
      emailAsunto: "",
      emailHtml: "",
      emailTexto: "",
    });
    enviado = { ok: r.ok, canal: r.canal };
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "portal.activar",
    entidad: "patients",
    entidadId: paciente.id,
    payload: { canal: enviado.canal, ok: enviado.ok },
  });

  if (!enviado.ok) {
    return NextResponse.json(
      { ok: false, error: "sin_canal_de_envio", token },
      { status: 422 },
    );
  }

  return NextResponse.json({ ok: true, canal: enviado.canal });
}
