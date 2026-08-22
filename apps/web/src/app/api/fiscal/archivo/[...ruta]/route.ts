import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join, resolve, sep } from "node:path";
import { guardStaff, guardError } from "@/lib/auth";
import { attachmentsRoot } from "@/lib/attachments";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ruta: string[] }> },
) {
  const g = await guardStaff("receipts.issue");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const { ruta } = await params;

  if (!Array.isArray(ruta) || ruta.length < 2 || ruta.length > 3) {
    return NextResponse.json({ error: "archivo_no_encontrado" }, { status: 404 });
  }
  if (
    ruta.some(
      (s) =>
        !s || s === "." || s === ".." || s.includes("..") || s.includes("/") || s.includes("\\"),
    )
  ) {
    return NextResponse.json({ error: "archivo_no_encontrado" }, { status: 404 });
  }
  if (ruta[0] !== "fiscal" || ruta[1] !== g.team.id) {
    return NextResponse.json({ error: "archivo_no_encontrado" }, { status: 404 });
  }

  const ultimo = ruta[ruta.length - 1] ?? "";
  const esXml = ultimo.endsWith(".xml");
  const esZip = ultimo.endsWith(".zip");
  const esPdf = ultimo.endsWith(".pdf");
  if (!esXml && !esZip && !esPdf) {
    return NextResponse.json({ error: "archivo_no_encontrado" }, { status: 404 });
  }

  const raiz = resolve(attachmentsRoot());
  const objetivo = resolve(join(raiz, ...ruta));
  if (!objetivo.startsWith(`${resolve(raiz, "fiscal")}${sep}`)) {
    return NextResponse.json({ error: "archivo_no_encontrado" }, { status: 404 });
  }

  try {
    const info = await stat(objetivo);
    if (!info.isFile()) throw new Error("no_es_archivo");
    const contenido = await readFile(objetivo);
    return new NextResponse(new Uint8Array(contenido), {
      status: 200,
      headers: {
        "Content-Type": esXml ? "text/xml" : esPdf ? "application/pdf" : "application/zip",
        "Content-Disposition": `attachment; filename="${ultimo}"`,
        "Content-Length": String(info.size),
      },
    });
  } catch {
    return NextResponse.json({ error: "archivo_no_encontrado" }, { status: 404 });
  }
}
