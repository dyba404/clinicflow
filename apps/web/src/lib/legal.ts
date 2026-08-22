import { eq } from "drizzle-orm";
import { getDb, legalSettings } from "@clinicflow/db";

export interface LegalRaw {
  razonSocial: string | null;
  ruc: string | null;
  direccionLegal: string | null;
  emailContactoDatos: string | null;
  telefonoContactoDatos: string | null;
  politicaPrivacidad: string | null;
  terminosUso: string | null;
  textoConsentimiento: string | null;
}

export interface LegalRender {
  nombreClinica: string;
  slug: string;
  razonSocial: string;
  ruc: string | null;
  direccionLegal: string | null;
  email: string | null;
  telefono: string | null;
  privacidad: string;
  terminos: string;
  consentimiento: string;
}

export function plantillaPrivacidad(d: {
  nombreClinica: string;
  razonSocial: string;
  ruc: string | null;
  direccion: string | null;
  email: string | null;
  telefono: string | null;
}): string {
  const idEmpresa = `${d.razonSocial}${d.ruc ? ` con RUC ${d.ruc}` : ""}${
    d.direccion ? `, con domicilio en ${d.direccion}` : ""
  }`;
  const contacto =
    [d.email ? `correo electrónico: ${d.email}` : null, d.telefono ? `teléfono: ${d.telefono}` : null]
      .filter(Boolean)
      .join("; ") || "los canales de contacto publicados en esta plataforma";
  return `POLÍTICA DE PRIVACIDAD Y TRATAMIENTO DE DATOS PERSONALES — ${d.nombreClinica.toUpperCase()}

1. RESPONSABLE DEL TRATAMIENTO
${idEmpresa} es el responsable del tratamiento de los datos personales que usted proporcione a través de la plataforma Clinicflow (${d.nombreClinica}). La presente política se emite en cumplimiento de la Ley N.° 29733, Ley de Protección de Datos Personales, y su Reglamento (D.S. N.° 003-2013-JUS).

2. DATOS QUE RECOPILAMOS
- Datos de identificación y contacto: nombres, apellidos, documento de identidad, celular y correo electrónico.
- Datos de salud: historia clínica, diagnósticos, tratamientos, exámenes, consentimientos y demás información clínica necesaria para su atención médica (datos sensibles).
- Datos de pago: registro de pagos, cuotas y comprobantes asociados a su atención.

3. FINALIDAD DEL TRATAMIENTO
Sus datos se utilizan exclusivamente para: gestionar citas y la prestación del servicio médico; mantener su historia clínica conforme a la normativa del sector salud; emitir comprobantes de pago; comunicarle recordatorios de citas, reprogramaciones y mensajes relacionados con su atención; y atender sus solicitudes de derechos ARCO.

4. CONSENTIMIENTO
El tratamiento de sus datos, incluidos los datos de salud, se realiza previa obtención de su consentimiento libre, previo, expreso e informado, el cual usted otorga al reservar una cita o firmar los consentimientos correspondientes. Puede revocarlo en cualquier momento, salvo que exista una obligación legal que requiera conservar la información (por ejemplo, la historia clínica).

5. DERECHOS ARCO (ACCESO, RECTIFICACIÓN, CANCELACIÓN, OPOSICIÓN)
Usted puede ejercer los derechos reconocidos por la Ley N.° 29733 enviando su solicitud al responsable del tratamiento a través de ${contacto}. La clínica atenderá su solicitud dentro de los plazos que establece la ley. Asimismo puede presentar un reclamo ante la Autoridad Nacional de Protección de Datos Personales (Ministerio de Justicia y Derechos Humanos).

6. PLAZO DE CONSERVACIÓN
Los datos se conservan mientras exista relación de atención y por los plazos mínimos exigidos por la normativa de salud para la historia clínica. Los datos de facturación se conservan conforme a los plazos tributarios aplicables.

7. MEDIDAS DE SEGURIDAD
El responsable aplica medidas técnicas y organizativas apropiadas: cifrado de datos sensibles y credenciales en reposo, controles de acceso por rol, registro de auditoría de accesos y respaldos periódicos de la información.

8. TRANSFERENCIA A TERCEROS
Sus datos no se venden ni se ceden a terceros. Solo se comunican a entidades cuando la ley lo exige (por ejemplo, SUNAT para la emisión de comprobantes electrónicos y el sistema de salud cuando corresponda), bajo las garantías legales aplicables.

9. MODIFICACIONES
El responsable puede actualizar esta política; la versión vigente será siempre la publicada en esta plataforma.

Fecha de última actualización: la indicada en esta página.`;
}

export function plantillaTerminos(d: {
  nombreClinica: string;
  razonSocial: string;
  ruc: string | null;
  direccion: string | null;
  email: string | null;
  telefono: string | null;
}): string {
  const contacto =
    [d.email ? `correo electrónico: ${d.email}` : null, d.telefono ? `teléfono: ${d.telefono}` : null]
      .filter(Boolean)
      .join("; ") || "los canales de contacto publicados en esta plataforma";
  return `TÉRMINOS Y CONDICIONES DE USO — ${d.nombreClinica.toUpperCase()}

1. OBJETO
Los presentes términos regulan el uso de la plataforma de citas y gestión de pacientes Clinicflow provista a los pacientes de ${d.razonSocial}${d.ruc ? ` (RUC ${d.ruc})` : ""} (${d.nombreClinica}). Al reservar una cita o utilizar el portal de pacientes, usted acepta estos términos.

2. RESERVA DE CITAS
Las reservas realizadas por esta plataforma quedan sujetas a confirmación por parte de la clínica. La inasistencia sin aviso oportuno puede generar la cancelación de la reserva conforme a las políticas internas de la clínica.

3. REPORTE Y CANCELACIÓN
Usted puede reprogramar o cancelar su cita desde el enlace de gestión que se le envía por correo o WhatsApp, dentro del plazo indicado en la confirmación. Vencido el plazo, debe contactarse con la clínica por ${contacto}.

4. PAGOS
Los pagos registrados en la plataforma (efectivo, transferencia, Yape/Plin u otros medios) constan como referencia de su estado de cuenta en la clínica. El pago mediante QR por conciliación queda sujeto a verificación por parte del personal de la clínica. Los comprobantes de pago electrónicos se emiten conforme a las normas de SUNAT.

5. INFORMACIÓN CLÍNICA
El acceso a su información de salud está restringido al personal autorizado de la clínica conforme a su rol profesional. La historia clínica se maneja según la Ley N.° 29414, Ley de los Derechos del Paciente.

6. PROPIEDAD INTELECTUAL
El software Clinicflow y sus contenidos son de titularidad del operador de la plataforma. Los datos que usted ingresa le pertenecen a usted y a la clínica responsable de su atención.

7. RESPONSABILIDAD
La plataforma es un medio de gestión de citas y comunicación; no reemplaza el acto médico ni constituye diagnóstico u opinión clínica de ningún tipo.

8. MODIFICACIONES Y LEY APLICABLE
Estos términos se rigen por las leyes de la República del Perú. Cualquier actualización será publicada en esta página.

Fecha de última actualización: la indicada en esta página.`;
}

export function plantillaConsentimiento(d: { nombreClinica: string }): string {
  return `Autorizo a ${d.nombreClinica} a tratar mis datos personales y de salud conforme a la Ley N.° 29733, con la finalidad de gestionar mis citas, atención médica y comunicaciones relacionadas, según la política de privacidad de esta clínica.`;
}

export async function legalRenderizadoPorSlug(slug: string): Promise<LegalRender | null> {
  const db = getDb();
  const { getTenantBySlug } = await import("@/lib/db");
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return null;

  const [legal] = await db
    .select()
    .from(legalSettings)
    .where(eq(legalSettings.tenantId, tenant.teamId))
    .limit(1);

  const raw: LegalRaw = {
    razonSocial: legal?.razonSocial ?? null,
    ruc: legal?.ruc ?? null,
    direccionLegal: legal?.direccionLegal ?? null,
    emailContactoDatos: legal?.emailContactoDatos ?? null,
    telefonoContactoDatos: legal?.telefonoContactoDatos ?? null,
    politicaPrivacidad: legal?.politicaPrivacidad ?? null,
    terminosUso: legal?.terminosUso ?? null,
    textoConsentimiento: legal?.textoConsentimiento ?? null,
  };

  const razonSocial = raw.razonSocial || tenant.name;
  const base = {
    nombreClinica: tenant.name,
    razonSocial,
    ruc: raw.ruc,
    direccion: raw.direccionLegal,
    email: raw.emailContactoDatos,
    telefono: raw.telefonoContactoDatos,
  };

  return {
    nombreClinica: tenant.name,
    slug: tenant.slug,
    razonSocial,
    ruc: raw.ruc,
    direccionLegal: raw.direccionLegal,
    email: raw.emailContactoDatos,
    telefono: raw.telefonoContactoDatos,
    privacidad: raw.politicaPrivacidad?.trim() || plantillaPrivacidad(base),
    terminos: raw.terminosUso?.trim() || plantillaTerminos(base),
    consentimiento: raw.textoConsentimiento?.trim() || plantillaConsentimiento(base),
  };
}
