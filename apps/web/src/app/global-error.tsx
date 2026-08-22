"use client";

import { DatabaseZap, RotateCw } from "lucide-react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "hsl(45 25% 98%)",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            margin: 24,
            padding: 32,
            textAlign: "center",
            background: "white",
            border: "1px solid hsl(42 12% 93%)",
            borderRadius: 16,
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              background: "hsl(174 66% 26% / 0.1)",
              color: "hsl(174 66% 26%)",
            }}
          >
            <DatabaseZap size={24} />
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            La base de datos tardó en despertar
          </h2>
          <p
            style={{
              marginTop: 8,
              fontSize: 14,
              lineHeight: 1.5,
              color: "hsl(42 12% 40%)",
            }}
          >
            El entorno local estaba suspendido. Se intentó levantarlo
            automáticamente. Si persiste, ejecuta{" "}
            <code
              style={{
                background: "hsl(40 14% 96%)",
                padding: "2px 6px",
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              npm run of:up
            </code>{" "}
            en una terminal.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: 36,
              padding: "0 16px",
              border: "none",
              borderRadius: 8,
              background: "hsl(174 66% 26%)",
              color: "white",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <RotateCw size={16} />
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
