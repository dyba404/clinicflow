import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, legalSettings } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";
import {
  plantillaConsentimiento,
  plantillaPrivacidad,
  plantillaTerminos,
} from "@/lib/legal";

export const dynamic = "force-dynamic";

const MAX_TEXT = 10_000;

interface CuerpoLegal {
  razonSocial?: string | null;
  ruc?: string | null;
  direccionLegal?: string | null;
  emailContactoDatos?: string | null;
  telefonoContactoDatos?: string | null;
  politicaPrivacidad?: string | null;
  terminosUso?: string | null;
  textoConsentimiento?: string | null;
}

function limpiarTexto(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export async function GET() {
  const g = await guardStaff("services.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const [legal] = await getDb()
    .select()
    .from(legalSettings)
    .where(eq(legalSettings.tenantId, g.team.id))
    .limit(1);

  return NextResponse.json({
    razonSocial: legal?.razonSocial ?? null,
    ruc: legal?.ruc ?? null,
    direccionLegal: legal?.direccionLegal ?? null,
    emailContactoDatos: legal?.emailContactoDatos ?? null,
    telefonoContactoDatos: legal?.telefonoContactoDatos ?? null,
    politicaPrivacidad: legal?.politicaPrivacidad ?? null,
    terminosUso: legal?.terminosUso ?? null,
    textoConsentimiento: legal?.textoConsentimiento ?? null,
    updatedAt: legal?.updatedAt?.toISOString() ?? null,
  });
}

export async function PUT(req: Request) {
  const g = await guardStaff("services.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: CuerpoLegal & { generarPlantillas?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const razonSocial = limpiarTexto(body.razonSocial);
  const ruc = limpiarTexto(body.ruc);
  const direccionLegal = limpiarTexto(body.direccionLegal);
  const email = limpiarTexto(body.emailContactoDatos);
  const telefono = limpiarTexto(body.telefonoContactoDatos);
  const politica = limpiarTexto(body.politicaPrivacidad);
  const terminos = limpiarTexto(body.terminosUso);
  const consentimiento = limpiarTexto(body.textoConsentimiento);

  if (ruc && !/^\d{11}$/.test(ruc)) {
    return NextResponse.json({ error: "ruc_invalido" }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "email_invalido" }, { status: 400 });
  }
  for (const [campo, valor] of [
    ["politica_privacidad", politica],
    ["terminos_uso", terminos],
    ["texto_consentimiento", consentimiento],
  ] as const) {
    if (valor && valor.length > MAX_TEXT) {
      return NextResponse.json(
        { error: "texto_demasiado_largo", message: `El campo ${campo} excede ${MAX_TEXT} caracteres.` },
        { status: 400 },
      );
    }
  }

  let politicaFinal = politica;
  let terminosFinal = terminos;
  let consentimientoFinal = consentimiento;
  if (body.generarPlantillas === true) {
    const base = {
      nombreClinica: g.team.name,
      razonSocial: razonSocial ?? g.team.name,
      ruc,
      direccion: direccionLegal,
      email,
      telefono,
    };
    if (!politicaFinal) politicaFinal = plantillaPrivacidad(base);
    if (!terminosFinal) terminosFinal = plantillaTerminos(base);
    if (!consentimientoFinal) consentimientoFinal = plantillaConsentimiento(base);
  }

  await getDb()
    .insert(legalSettings)
    .values({
      tenantId: g.team.id,
      razonSocial,
      ruc,
      direccionLegal,
      emailContactoDatos: email,
      telefonoContactoDatos: telefono,
      politicaPrivacidad: politicaFinal,
      terminosUso: terminosFinal,
      textoConsentimiento: consentimientoFinal,
      updatedBy: g.user.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [legalSettings.tenantId],
      set: {
        razonSocial,
        ruc,
        direccionLegal,
        emailContactoDatos: email,
        telefonoContactoDatos: telefono,
        politicaPrivacidad: politicaFinal,
        terminosUso: terminosFinal,
        textoConsentimiento: consentimientoFinal,
        updatedBy: g.user.id,
        updatedAt: new Date(),
      },
    });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "legal.actualizar",
    entidad: "legal_settings",
    entidadId: g.team.id,
    payload: {
      conRazonSocial: Boolean(razonSocial),
      conRuc: Boolean(ruc),
      conPolitica: Boolean(politicaFinal),
      conTerminos: Boolean(terminosFinal),
      conConsentimiento: Boolean(consentimientoFinal),
      generadas: body.generarPlantillas === true,
    },
  });

  return NextResponse.json({
    ok: true,
    razonSocial,
    ruc,
    direccionLegal,
    emailContactoDatos: email,
    telefonoContactoDatos: telefono,
    politicaPrivacidad: politicaFinal,
    terminosUso: terminosFinal,
    textoConsentimiento: consentimientoFinal,
  });
}
