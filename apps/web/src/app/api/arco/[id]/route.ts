import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { ZipArchive } from "archiver";
import { and, desc, eq } from "drizzle-orm";
import {
  getDb,
  dataRequests,
  patients,
  appointments,
  clinicalRecords,
  orders,
  attachments,
  services,
  users,
} from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ESTADOS_VALIDOS = ["atendida", "rechazada"] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("reports.view_all");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { estado?: string; detalle?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const estado = body.estado;
  if (!estado || !ESTADOS_VALIDOS.includes(estado as (typeof ESTADOS_VALIDOS)[number])) {
    return NextResponse.json({ error: "estado_invalido" }, { status: 400 });
  }
  const detalle =
    typeof body.detalle === "string" && body.detalle.trim()
      ? body.detalle.trim().slice(0, 500)
      : null;

  const [solicitud] = await getDb()
    .select({ id: dataRequests.id, estado: dataRequests.estado, tipo: dataRequests.tipo })
    .from(dataRequests)
    .where(and(eq(dataRequests.id, id), eq(dataRequests.tenantId, g.team.id)))
    .limit(1);
  if (!solicitud) {
    return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
  }
  if (solicitud.estado !== "pendiente") {
    return NextResponse.json({ error: "ya_resuelta" }, { status: 409 });
  }

  await getDb()
    .update(dataRequests)
    .set({ estado, detalle, gestionadoPor: g.user.id })
    .where(and(eq(dataRequests.id, id), eq(dataRequests.tenantId, g.team.id)));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: estado === "atendida" ? "arco.atender" : "arco.rechazar",
    entidad: "data_requests",
    entidadId: id,
    payload: { estado, detalle },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("reports.view_all");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const [solicitud] = await getDb()
    .select({
      id: dataRequests.id,
      tipo: dataRequests.tipo,
      estado: dataRequests.estado,
      detalle: dataRequests.detalle,
      createdAt: dataRequests.createdAt,
      patientId: dataRequests.patientId,
    })
    .from(dataRequests)
    .where(and(eq(dataRequests.id, id), eq(dataRequests.tenantId, g.team.id)))
    .limit(1);
  if (!solicitud) {
    return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
  }

  const [paciente] = await getDb()
    .select()
    .from(patients)
    .where(and(eq(patients.id, solicitud.patientId), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) {
    return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
  }

  const db = getDb();
  const [citas, registros, ordenesClinicas, adjuntos] = await Promise.all([
    db
      .select({
        id: appointments.id,
        fecha: appointments.fecha,
        horaIni: appointments.horaIni,
        estado: appointments.estado,
        monto: appointments.monto,
        montoPagado: appointments.montoPagado,
        notas: appointments.notas,
        servicio: services.nombre,
      })
      .from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(and(eq(appointments.tenantId, g.team.id), eq(appointments.patientId, paciente.id)))
      .orderBy(desc(appointments.fecha)),
    db
      .select({
        id: clinicalRecords.id,
        nota: clinicalRecords.nota,
        appointmentId: clinicalRecords.appointmentId,
        createdAt: clinicalRecords.createdAt,
        autor: users.name,
      })
      .from(clinicalRecords)
      .leftJoin(users, eq(clinicalRecords.createdBy, users.id))
      .where(eq(clinicalRecords.patientId, paciente.id))
      .orderBy(desc(clinicalRecords.createdAt)),
    db
      .select({
        id: orders.id,
        tipo: orders.tipo,
        nombre: orders.nombre,
        estado: orders.estado,
        indicacion: orders.indicacion,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(eq(orders.tenantId, g.team.id), eq(orders.patientId, paciente.id)))
      .orderBy(desc(orders.createdAt)),
    db
      .select({
        id: attachments.id,
        nombre: attachments.nombre,
        mime: attachments.mime,
        tipo: attachments.tipo,
        fotoTipo: attachments.fotoTipo,
        tratamiento: attachments.tratamiento,
        nota: attachments.nota,
        storagePath: attachments.storagePath,
        createdAt: attachments.createdAt,
      })
      .from(attachments)
      .where(and(eq(attachments.tenantId, g.team.id), eq(attachments.patientId, paciente.id)))
      .orderBy(desc(attachments.createdAt)),
  ]);

  const datos = {
    solicitud: {
      id: solicitud.id,
      tipo: solicitud.tipo,
      estado: solicitud.estado,
      detalle: solicitud.detalle,
      recibidaEl: solicitud.createdAt,
      generadaEl: new Date(),
    },
    paciente: {
      id: paciente.id,
      nombre: paciente.nombre,
      celular: paciente.celular,
      email: paciente.email,
      documento: paciente.documento,
      fnac: paciente.fnac,
      alergias: paciente.alergias,
      antecedentes: paciente.antecedentes,
      medicacion: paciente.medicacion,
      gestacion: paciente.gestacion,
      activo: paciente.activo,
      registradoEl: paciente.createdAt,
    },
    citas: citas.map((c) => ({
      fecha: c.fecha,
      hora: c.horaIni,
      estado: c.estado,
      servicio: c.servicio,
      monto: c.monto,
      montoPagado: c.montoPagado,
      notas: c.notas,
    })),
    historiaClinica: registros.map((r) => ({
      fecha: r.createdAt,
      nota: r.nota,
      autor: r.autor,
    })),
    ordenesMedicas: ordenesClinicas.map((o) => ({
      tipo: o.tipo,
      nombre: o.nombre,
      estado: o.estado,
      indicacion: o.indicacion,
      creadaEl: o.createdAt,
    })),
    adjuntos: adjuntos.map((a) => ({
      nombre: a.nombre,
      tipo: a.tipo,
      fotoTipo: a.fotoTipo,
      tratamiento: a.tratamiento,
      nota: a.nota,
      subidoEl: a.createdAt,
    })),
  };

  const archive = new ZipArchive({ zlib: { level: 5 } });
  const chunks: Buffer[] = [];
  archive.on("data", (c: Buffer) => chunks.push(c));
  archive.append(JSON.stringify(datos, null, 2), { name: "datos.json" });

  const usados = new Map<string, number>();
  for (const adjunto of adjuntos) {
    let nombre = adjunto.nombre.trim() || `${adjunto.id}${extname(adjunto.storagePath) || ".bin"}`;
    nombre = nombre.replace(/[\\/:*?"<>|]/g, "_").replace(/^\.+/, "");
    const contador = usados.get(nombre) ?? 0;
    usados.set(nombre, contador + 1);
    if (contador > 0) nombre = `${nombre} (${contador + 1})`;
    try {
      const st = await stat(adjunto.storagePath);
      if (!st.isFile()) continue;
      archive.append(createReadStream(adjunto.storagePath), { name: `adjuntos/${nombre}` });
    } catch {
      continue;
    }
  }

  try {
    await new Promise<void>((resolve, reject) => {
      archive.on("end", resolve);
      archive.on("error", reject);
      void archive.finalize();
    });
  } catch {
    return NextResponse.json({ error: "error_zip" }, { status: 500 });
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "arco.descargar",
    entidad: "data_requests",
    entidadId: solicitud.id,
    payload: { patientId: paciente.id, adjuntosIncluidos: adjuntos.length },
  });

  const buffer = Buffer.concat(chunks);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="arco_${paciente.documento ?? solicitud.id.slice(0, 8)}.zip"`,
    },
  });
}
