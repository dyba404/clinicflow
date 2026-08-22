import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@clinicflow/db";
import { mailConfigurado } from "@/lib/mail";
import { lycetConfigurado } from "@/lib/lycet";

export const dynamic = "force-dynamic";

export async function GET() {
  const ts = new Date().toISOString();
  let db = false;
  try {
    await Promise.race([
      getDb().execute(sql`select 1`),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
    db = true;
  } catch {
    db = false;
  }

  const checks = {
    db,
    correo: mailConfigurado(),
    lycet: lycetConfigurado(),
  };
  const ok = db;

  return NextResponse.json({ ok, version: "1.0.0", ts, checks }, ok ? undefined : { status: 503 });
}
