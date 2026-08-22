import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb, branches } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

function slugify(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET() {
  const g = await guardStaff();
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const rows = await getDb()
    .select({
      id: branches.id,
      nombre: branches.nombre,
      slug: branches.slug,
    })
    .from(branches)
    .where(and(eq(branches.tenantId, g.team.id), eq(branches.activo, true)))
    .orderBy(asc(branches.createdAt));
  return NextResponse.json({ sucursales: rows });
}

export async function POST(req: Request) {
  const g = await guardStaff("branches.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    nombre?: string;
    slug?: string;
    direccion?: string | null;
    telefono?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  if (!nombre || nombre.length > 60) {
    return NextResponse.json({ error: "nombre_invalido" }, { status: 400 });
  }

  let slug = typeof body.slug === "string" ? slugify(body.slug) : "";
  if (!slug) slug = slugify(nombre);
  if (!slug || slug.length > 60) {
    return NextResponse.json({ error: "slug_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [choque] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.tenantId, g.team.id), eq(branches.slug, slug)))
    .limit(1);
  if (choque) {
    return NextResponse.json({ error: "slug_duplicado" }, { status: 409 });
  }

  const direccion = body.direccion?.trim() || null;
  const telefono = body.telefono?.trim() || null;

  const [row] = await db
    .insert(branches)
    .values({
      tenantId: g.team.id,
      nombre,
      slug,
      direccion,
      telefono,
    })
    .returning({
      id: branches.id,
      nombre: branches.nombre,
      slug: branches.slug,
      direccion: branches.direccion,
      telefono: branches.telefono,
      activo: branches.activo,
    });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "sucursal.crear",
    entidad: "branches",
    entidadId: row!.id,
    payload: { nombre: row!.nombre, slug: row!.slug },
  });

  return NextResponse.json({ ok: true, sucursal: row }, { status: 201 });
}
