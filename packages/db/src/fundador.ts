import { eq } from "drizzle-orm";
import * as schema from "./schema.js";

export const FOUNDER_EMAIL_DEV = "fundador@clinicflow.pe";
export const FOUNDER_PASSWORD_DEV = "CambiarYa2026!";
export const FOUNDER_NAME_DEV = "Operador Clinicflow";

export interface FundadorOpts {
  email: string;
  name: string;
  passwordHash: string;
  mustChangePassword?: boolean;
}

export async function upsertFundador(
  db: any,
  opts: FundadorOpts,
): Promise<{ id: string; creado: boolean }> {
  const email = opts.email.trim().toLowerCase();
  const [existente] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existente) {
    return { id: existente.id, creado: false };
  }

  const [nuevo] = await db
    .insert(schema.users)
    .values({
      name: opts.name,
      email,
      passwordHash: opts.passwordHash,
      isPlatformAdmin: true,
      mustChangePassword: opts.mustChangePassword ?? true,
    })
    .returning({ id: schema.users.id });

  return { id: nuevo.id, creado: true };
}
