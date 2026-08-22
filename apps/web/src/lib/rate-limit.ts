const VENTANA_MS = 60_000;
const LIMITE_DEFECTO = 30;
const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limite: number = LIMITE_DEFECTO,
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  let bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + VENTANA_MS };
    store.set(key, bucket);
  }
  bucket.count += 1;

  if (store.size > 5000) {
    for (const [k, v] of store) {
      if (v.resetAt <= now) store.delete(k);
    }
  }

  if (bucket.count > limite) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }
  return { allowed: true, retryAfterMs: 0 };
}

export function ipReq(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "desconocido"
  );
}
