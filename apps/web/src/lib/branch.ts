import { cookies } from "next/headers";
import { and, asc, eq } from "drizzle-orm";
import { getDb, branches } from "@clinicflow/db";

export const SUCURSAL_COOKIE = "of_sucursal";

export async function sucursalesDe(teamId: string) {
  return getDb()
    .select({
      id: branches.id,
      nombre: branches.nombre,
      slug: branches.slug,
    })
    .from(branches)
    .where(and(eq(branches.tenantId, teamId), eq(branches.activo, true)))
    .orderBy(asc(branches.createdAt));
}

export async function sucursalActiva(teamId: string): Promise<string | null> {
  const store = await cookies();
  const id = store.get(SUCURSAL_COOKIE)?.value;
  if (!id) return null;
  const [row] = await getDb()
    .select({ id: branches.id })
    .from(branches)
    .where(
      and(
        eq(branches.id, id),
        eq(branches.tenantId, teamId),
        eq(branches.activo, true),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}
