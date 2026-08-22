import { NextResponse } from "next/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, campaigns, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";
import { pacientesDormidos } from "@/lib/console-data";

export const dynamic = "force-dynamic";

type Audiencia = Array<{ patientId: string }>;

async function audienciaCumple(teamId: string, timezone: string): Promise<Audiencia> {
  const mes = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, month: "2-digit" }).format(
    new Date(),
  );
  const todos = await pacientesDormidos(teamId);
  const activos = todos.filter((p) => p.estado === "activo");
  if (activos.length === 0) return [];
  const rows = await getDb()
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.tenantId, teamId),
        eq(patients.activo, true),
        inArray(
          patients.id,
          activos.map((p) => p.id),
        ),
        sql`to_char(${patients.fnac}, 'MM') = ${mes}`,
      ),
    );
  return rows.map((r) => ({ patientId: r.id }));
}

async function audienciaReactivacion(teamId: string): Promise<Audiencia> {
  const todos = await pacientesDormidos(teamId);
  return todos.filter((p) => p.estado !== "activo").map((p) => ({ patientId: p.id }));
}

export async function GET() {
  const g = await guardStaff("campaigns.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const rows = await getDb()
    .select()
    .from(campaigns)
    .where(eq(campaigns.tenantId, g.team.id))
    .orderBy(desc(campaigns.createdAt));

  return NextResponse.json({ campanas: rows });
}

export async function POST(req: Request) {
  const g = await guardStaff("campaigns.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { tipo?: string; titulo?: string; mensaje?: string; canal?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const tipo = body.tipo;
  if (tipo !== "cumple" && tipo !== "reactivacion") {
    return NextResponse.json({ error: "tipo_invalido" }, { status: 400 });
  }
  const titulo = body.titulo?.trim();
  if (!titulo || titulo.length > 120) {
    return NextResponse.json({ error: "titulo_invalido" }, { status: 400 });
  }
  const mensaje = body.mensaje?.trim();
  if (!mensaje || mensaje.length > 500) {
    return NextResponse.json({ error: "mensaje_invalido" }, { status: 400 });
  }
  const canal = body.canal ?? "email";
  if (canal !== "email") {
    return NextResponse.json({ error: "canal_invalido" }, { status: 400 });
  }

  const audiencia =
    tipo === "cumple"
      ? await audienciaCumple(g.team.id, g.team.timezone)
      : await audienciaReactivacion(g.team.id);

  const [row] = await getDb()
    .insert(campaigns)
    .values({
      tenantId: g.team.id,
      tipo,
      titulo,
      mensaje,
      canal,
      estado: "programada",
      audiencia,
      createdBy: g.user.id,
    })
    .returning();

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "campana.crear",
    entidad: "campaigns",
    entidadId: row!.id,
    payload: { tipo, audiencia: audiencia.length },
  });

  return NextResponse.json({ ok: true, campana: row }, { status: 201 });
}
