import { NextResponse } from "next/server";

export const config = { matcher: ["/api/:path*"] };

const HEADERS_SEGURIDAD: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export function middleware() {
  const res = NextResponse.next();
  for (const [clave, valor] of Object.entries(HEADERS_SEGURIDAD)) {
    res.headers.set(clave, valor);
  }
  return res;
}
