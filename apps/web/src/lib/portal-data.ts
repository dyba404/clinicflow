import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import {
  getDb,
  appointments,
  services,
  memberships,
  users,
  installments,
  payments,
  receipts,
  quotes,
  signedConsents,
  orders,
  orderResults,
  consultations,
  consultDiagnoses,
  cie10,
  prescriptions,
  patients,
} from "@clinicflow/db";

const ESTADOS_PROXIMOS = ["solicitada", "confirmada", "en_espera", "en_atencion"] as const;

export interface PortalDataInput {
  patientId: string;
  tenantId: string;
  clinicaNombre: string;
  clinicaSlug: string;
  pacienteNombre: string;
}

export async function armarPortalData(input: PortalDataInput) {
  const db = getDb();

  const citas = await db
    .select({
      id: appointments.id,
      fecha: appointments.fecha,
      horaIni: appointments.horaIni,
      horaFin: appointments.horaFin,
      estado: appointments.estado,
      servicio: services.nombre,
      serviceId: appointments.serviceId,
      doctorId: appointments.doctorId,
      doctorNombre: users.name,
      instruccionesPre: services.instruccionesPre,
      instruccionesPost: services.instruccionesPost,
    })
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(memberships, eq(appointments.doctorId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(
      and(
        eq(appointments.patientId, input.patientId),
        eq(appointments.tenantId, input.tenantId),
      ),
    )
    .orderBy(appointments.fecha, appointments.horaIni);

  const proximas = citas
    .filter((c) => (ESTADOS_PROXIMOS as readonly string[]).includes(c.estado))
    .map((c) => ({
      id: c.id,
      fecha: c.fecha,
      horaIni: c.horaIni,
      horaFin: c.horaFin,
      estado: c.estado,
      servicio: c.servicio,
      doctor: c.doctorNombre,
      serviceId: c.serviceId,
      doctorId: c.doctorId,
      instruccionesPre: c.instruccionesPre,
      instruccionesPost: c.instruccionesPost,
      puedeConfirmar: c.estado === "solicitada",
    }));

  const historial = citas
    .filter((c) => !(ESTADOS_PROXIMOS as readonly string[]).includes(c.estado))
    .map((c) => ({
      id: c.id,
      fecha: c.fecha,
      horaIni: c.horaIni,
      estado: c.estado,
      servicio: c.servicio,
      doctor: c.doctorNombre,
    }))
    .sort((a, b) => (a.fecha === b.fecha ? (a.horaIni < b.horaIni ? 1 : -1) : a.fecha < b.fecha ? 1 : -1))
    .slice(0, 20);

  const cuotas = await db
    .select({
      id: installments.id,
      concepto: installments.concepto,
      n: installments.n,
      monto: installments.monto,
      pagado: installments.pagado,
      vence: installments.vence,
      estado: installments.estado,
    })
    .from(installments)
    .where(
      and(eq(installments.patientId, input.patientId), eq(installments.tenantId, input.tenantId)),
    )
    .orderBy(installments.vence, installments.n);

  const cuotasPendientes = cuotas
    .filter((c) => c.estado === "pendiente" || c.estado === "parcial" || c.estado === "vencida")
    .map((c) => ({
      id: c.id,
      concepto: c.concepto,
      n: c.n,
      monto: c.monto,
      saldo: (Math.round((Number(c.monto) - Number(c.pagado)) * 100) / 100).toFixed(2),
      vence: c.vence,
      estado: c.estado,
    }));

  const comprobantes = await db
    .select({
      id: receipts.id,
      tipo: receipts.tipo,
      serie: receipts.serie,
      correlativo: receipts.correlativo,
      sunatEstado: receipts.sunatEstado,
      emitidaAt: receipts.emitidaAt,
      patientId: payments.patientId,
    })
    .from(receipts)
    .innerJoin(payments, eq(receipts.paymentId, payments.id))
    .where(
      and(
        eq(receipts.tenantId, input.tenantId),
        eq(payments.patientId, input.patientId),
        eq(receipts.sunatEstado, "aceptado"),
        inArray(receipts.tipo, ["boleta", "factura"]),
      ),
    );

  const presupuestos = await db
    .select({
      id: quotes.id,
      titulo: quotes.titulo,
      total: quotes.total,
      estado: quotes.estado,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .where(
      and(
        eq(quotes.patientId, input.patientId),
        inArray(quotes.estado, ["enviado", "aprobado"]),
      ),
    )
    .orderBy(desc(quotes.createdAt));

  const consentimientos = await db
    .select({
      id: signedConsents.id,
      servicioNombre: signedConsents.servicioNombre,
      signedBy: signedConsents.signedBy,
      signedAt: signedConsents.signedAt,
    })
    .from(signedConsents)
    .where(eq(signedConsents.patientId, input.patientId))
    .orderBy(signedConsents.signedAt);

  const ordenesLiberadas = await db
    .select({
      id: orders.id,
      nombre: orders.nombre,
      tipo: orders.tipo,
      estado: orders.estado,
      resultadoAt: orders.resultadoAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.patientId, input.patientId),
        eq(orders.tenantId, input.tenantId),
        inArray(orders.estado, ["liberada", "entregada"]),
        inArray(orders.tipo, ["laboratorio", "imagen"]),
      ),
    )
    .orderBy(desc(orders.resultadoAt));

  const resultados = ordenesLiberadas.length
    ? await db
        .select({
          orderId: orderResults.orderId,
          parametro: orderResults.parametro,
          valorText: orderResults.valorText,
          valorNum: orderResults.valorNum,
          unidad: orderResults.unidad,
          referencia: orderResults.referencia,
          flag: orderResults.flag,
        })
        .from(orderResults)
        .where(
          inArray(
            orderResults.orderId,
            ordenesLiberadas.map((o) => o.id),
          ),
        )
        .orderBy(asc(orderResults.createdAt))
    : [];

  const resultadosPorOrden = new Map<string, typeof resultados>();
  for (const fila of resultados) {
    const arr = resultadosPorOrden.get(fila.orderId) ?? [];
    arr.push(fila);
    resultadosPorOrden.set(fila.orderId, arr);
  }

  const consultasPublicadas = await db
    .select({
      id: consultations.id,
      motivoConsulta: consultations.motivoConsulta,
      plan: consultations.plan,
      publicarNota: consultations.publicarNota,
      subjetivo: consultations.subjetivo,
      objetivo: consultations.objetivo,
      evaluacion: consultations.evaluacion,
      publicadoAt: consultations.publicadoAt,
      doctorNombre: users.name,
    })
    .from(consultations)
    .leftJoin(memberships, eq(consultations.doctorMembershipId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(
      and(
        eq(consultations.patientId, input.patientId),
        eq(consultations.tenantId, input.tenantId),
        isNotNull(consultations.publicadoAt),
      ),
    )
    .orderBy(desc(consultations.publicadoAt));

  const diagnosticos = consultasPublicadas.length
    ? await db
        .select({
          consultationId: consultDiagnoses.consultationId,
          codigo: consultDiagnoses.cie10Codigo,
          descripcion: cie10.descripcion,
          esPrincipal: consultDiagnoses.esPrincipal,
        })
        .from(consultDiagnoses)
        .innerJoin(cie10, eq(consultDiagnoses.cie10Codigo, cie10.codigo))
        .where(
          and(
            inArray(
              consultDiagnoses.consultationId,
              consultasPublicadas.map((c) => c.id),
            ),
            eq(consultDiagnoses.ocultoPortal, false),
          ),
        )
    : [];

  const recetas = consultasPublicadas.length
    ? await db
        .select({
          consultationId: prescriptions.consultationId,
          medicamento: prescriptions.medicamento,
          dosis: prescriptions.dosis,
          frecuencia: prescriptions.frecuencia,
          duracionDias: prescriptions.duracionDias,
          indicaciones: prescriptions.indicaciones,
        })
        .from(prescriptions)
        .where(
          and(
            inArray(
              prescriptions.consultationId,
              consultasPublicadas.map((c) => c.id),
            ),
            eq(prescriptions.estado, "emitida"),
          ),
        )
    : [];

  const diagnosticosPorConsulta = new Map<string, typeof diagnosticos>();
  for (const d of diagnosticos) {
    const arr = diagnosticosPorConsulta.get(d.consultationId) ?? [];
    arr.push(d);
    diagnosticosPorConsulta.set(d.consultationId, arr);
  }
  const recetasPorConsulta = new Map<string, typeof recetas>();
  for (const r of recetas) {
    const arr = recetasPorConsulta.get(r.consultationId) ?? [];
    arr.push(r);
    recetasPorConsulta.set(r.consultationId, arr);
  }

  const [ficha] = await db
    .select({
      alergias: patients.alergias,
      antecedentes: patients.antecedentes,
      medicacion: patients.medicacion,
      gestacion: patients.gestacion,
      email: patients.email,
      documento: patients.documento,
      fnac: patients.fnac,
      celular: patients.celular,
    })
    .from(patients)
    .where(eq(patients.id, input.patientId))
    .limit(1);

  const aCargo = await db
    .select({
      id: patients.id,
      nombre: patients.nombre,
    })
    .from(patients)
    .where(
      and(
        eq(patients.tenantId, input.tenantId),
        eq(patients.representanteId, input.patientId),
        eq(patients.activo, true),
      ),
    )
    .orderBy(asc(patients.nombre));

  const citasACargo = aCargo.length
    ? await db
        .select({
          id: appointments.id,
          patientId: appointments.patientId,
          fecha: appointments.fecha,
          horaIni: appointments.horaIni,
          horaFin: appointments.horaFin,
          estado: appointments.estado,
          servicio: services.nombre,
          doctorNombre: users.name,
        })
        .from(appointments)
        .leftJoin(services, eq(appointments.serviceId, services.id))
        .leftJoin(memberships, eq(appointments.doctorId, memberships.id))
        .leftJoin(users, eq(memberships.userId, users.id))
        .where(
          and(
            eq(appointments.tenantId, input.tenantId),
            inArray(appointments.patientId, aCargo.map((p) => p.id)),
          ),
        )
        .orderBy(appointments.fecha, appointments.horaIni)
    : [];

  return {
    clinica: { nombre: input.clinicaNombre, slug: input.clinicaSlug },
    paciente: {
      nombre: input.pacienteNombre,
      celular: ficha?.celular ?? null,
      salud: ficha
        ? {
            alergias: ficha.alergias,
            antecedentes: ficha.antecedentes,
            medicacion: ficha.medicacion,
            gestacion: ficha.gestacion,
          }
        : null,
    },
    aCargo: aCargo.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      proximasCitas: citasACargo
        .filter(
          (c) =>
            c.patientId === p.id &&
            (ESTADOS_PROXIMOS as readonly string[]).includes(c.estado),
        )
        .map((c) => ({
          id: c.id,
          fecha: c.fecha,
          horaIni: c.horaIni,
          horaFin: c.horaFin,
          estado: c.estado,
          servicio: c.servicio,
          doctor: c.doctorNombre,
        })),
    })),
    proximasCitas: proximas,
    historial,
    cuotasPendientes,
    comprobantes: comprobantes.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      numero: `${c.serie}-${String(c.correlativo).padStart(8, "0")}`,
      emitidaAt: c.emitidaAt,
    })),
    presupuestos: presupuestos.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      total: p.total,
      estado: p.estado,
    })),
    consentimientos: consentimientos.map((c) => ({
      servicioNombre: c.servicioNombre,
      signedBy: c.signedBy,
      signedAt: c.signedAt,
    })),
    resultados: ordenesLiberadas
      .filter((o) => (resultadosPorOrden.get(o.id)?.length ?? 0) > 0)
      .map((o) => ({
        id: o.id,
        nombre: o.nombre,
        tipo: o.tipo,
        estado: o.estado,
        resultadoAt: o.resultadoAt,
        parametros: (resultadosPorOrden.get(o.id) ?? []).map((f) => ({
          parametro: f.parametro,
          valorText: f.valorText,
          valorNum: f.valorNum,
          unidad: f.unidad,
          referencia: f.referencia,
          flag: f.flag,
        })),
      })),
    consultas: consultasPublicadas.map((c) => ({
      id: c.id,
      fecha: c.publicadoAt,
      doctor: c.doctorNombre,
      motivo: c.motivoConsulta,
      plan: c.plan,
      notaCompleta: c.publicarNota
        ? { subjetivo: c.subjetivo, objetivo: c.objetivo, evaluacion: c.evaluacion }
        : null,
      diagnosticos: (diagnosticosPorConsulta.get(c.id) ?? []).map((d) => ({
        codigo: d.codigo,
        descripcion: d.descripcion,
        esPrincipal: d.esPrincipal,
      })),
      recetas: (recetasPorConsulta.get(c.id) ?? []).map((r) => ({
        medicamento: r.medicamento,
        dosis: r.dosis,
        frecuencia: r.frecuencia,
        duracionDias: r.duracionDias,
        indicaciones: r.indicaciones,
      })),
    })),
  };
}
