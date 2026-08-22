import type { StaffRole } from "@clinicflow/core";

export interface Guia {
  id: string;
  titulo: string;
  descripcion: string;
  roles: StaffRole[];
  captura?: string;
  pasos: string[];
  tip?: string;
}

export interface GuiaSeccion {
  id: string;
  icono: string;
  titulo: string;
  descripcion: string;
  guias: Guia[];
}

export const GUIAS: GuiaSeccion[] = [
  {
    id: "primeros-pasos",
    icono: "rocket",
    titulo: "Primeros pasos",
    descripcion: "Configura tu clínica en 30 minutos y queda lista para recibir pacientes.",
    guias: [
      {
        id: "configurar-clinica",
        titulo: "Configura los datos de tu clínica",
        descripcion:
          "Datos del responsable legal y textos de privacidad que se publican en tu página de reservas.",
        roles: ["owner"],
        captura: "/guia/config-legal.png",
        pasos: [
          "Abre Configuración → Cumplimiento legal.",
          "Completa la razón social, RUC, domicilio legal y el correo donde recibirás las solicitudes de datos personales (Ley 29733).",
          "Pulsa “Generar textos con mis datos”: las plantillas de política de privacidad y términos se rellenan con tus datos automáticamente.",
          "Revisa los textos generados en las vistas previas públicas. Si tu asesor legal te indica otra versión, reemplázala en los campos de texto.",
          "Guarda. Los cambios se publican al instante en /tu-clinica/privacidad y /tu-clinica/terminos.",
        ],
        tip: "Solo el rol Dueño/a puede editar la configuración legal; cada cambio queda registrado en Auditoría.",
      },
      {
        id: "crear-servicios",
        titulo: "Crea tus servicios y precios",
        descripcion: "El catálogo de servicios es la base de la página de reservas y de la caja.",
        roles: ["owner"],
        captura: "/guia/config-servicios.png",
        pasos: [
          "Abre Configuración → Servicios.",
          "Pulsa “Nuevo servicio”: nombre, duración en minutos (define el tamaño del slot), buffer y precio.",
          "El buffer es el tiempo extra que se respeta entre citas (ej. limpieza entre pacientes).",
          "Activa o desactiva servicios según temporada; los desactivados desaparecen de la página pública.",
        ],
        tip: "La duración + buffer del servicio determinan qué horarios se ofrecen en la reserva en línea.",
      },
      {
        id: "invitar-equipo",
        titulo: "Invita a tu equipo",
        descripcion:
          "Cada miembro recibe una invitación por correo con su rol: recepción, asistente u odontólogo.",
        roles: ["owner"],
        pasos: [
          "Abre Personal → Invitar.",
          "Escribe el correo y elige el rol: Recepción (agenda + caja + comprobantes), Asistente (datos + estados + adjuntos) u Odontólogo (su agenda + fichas + notas clínicas).",
          "El invitado recibe un enlace para crear su contraseña.",
          "Revisa en Personal quién aceptó la invitación y ajusta roles si hace falta.",
        ],
        tip: "Por defecto el asistente NO tiene acceso a caja ni a ingresos; puedes elevarlo a recepción si tu clínica es pequeña.",
      },
      {
        id: "compartir-reservas",
        titulo: "Comparte tu página pública de reservas",
        descripcion: "Envía el enlace a tus pacientes: ellos reservan sin descargar nada.",
        roles: ["owner", "receptionist"],
        captura: "/guia/reserva.png",
        pasos: [
          "Tu página pública es: la dirección de Clinicflow + / + el nombre corto de tu clínica (slug) + /reserva. La ves en Soporte → Compartir página.",
          "Compártela por WhatsApp y añádela a tus perfiles de Instagram, Facebook y Google.",
          "El paciente elige servicio, fecha e horario, y envía su solicitud.",
          "Cada solicitud aparece en la cola de Solicitudes para que recepción la confirme.",
        ],
      },
    ],
  },
  {
    id: "citas",
    icono: "calendar",
    titulo: "Citas y sala de espera",
    descripcion: "El día a día de recepción y consultorio: confirmar, atender y cerrar cada cita.",
    guias: [
      {
        id: "confirmar-solicitudes",
        titulo: "Confirma una solicitud de cita",
        descripcion: "Revisa la cola de pedidos en línea y asigna doctor y hora exacta.",
        roles: ["owner", "receptionist"],
        captura: "/guia/solicitudes.png",
        pasos: [
          "Abre Solicitudes en el menú: ahí aparecen los pedidos enviados por la página pública.",
          "Revisa paciente, servicio, fecha y doctor preferido. Si el horario no funciona, usa Rechazar y el paciente recibirá un correo para reelegir.",
          "Pulsa Confirmar para asignar la cita al doctor y horario elegidos.",
          "Al confirmar, el paciente recibe un correo con la hora exacta y un enlace privado para reprogramar o cancelar.",
        ],
      },
      {
        id: "dia-a-dia",
        titulo: "El flujo de la cita: llegada → atención → cierre",
        descripcion: "Estados de cada cita y quién los mueve durante el día.",
        roles: ["owner", "receptionist", "assistant", "doctor"],
        captura: "/guia/sala-espera.png",
        pasos: [
          "Llega el paciente: recepción lo registra en Sala de espera (botón Llegó).",
          "El asistente o doctor pulsa Llamar cuando lo atiende; el paciente pasa a “En atención”.",
          "El doctor escribe la nota clínica y pulsa Finalizar: la cita queda Atendida.",
          "Recepción cobra el pago y registra la próxima cita.",
          "Si el paciente no llega, márcala como No-show (puedes deshacerlo si fue un error).",
        ],
        tip: "Los botones “Deshacer” permiten revertir check-in o llamado durante 5 segundos por si hay confusión.",
      },
      {
        id: "reprogramar",
        titulo: "Reprogramar o cancelar una cita",
        descripcion: "Desde la agenda o desde el enlace que recibió el paciente.",
        roles: ["owner", "receptionist", "doctor"],
        captura: "/guia/agenda.png",
        pasos: [
          "En Agenda, abre la cita y usa Reprogramar (nueva fecha/hora) o Cancelar.",
          "El paciente recibe la notificación del cambio automáticamente por correo.",
          "El paciente también puede reprogramar o cancelar desde el enlace privado de su correo (sin crear cuenta, válido 30 días).",
          "Al cancelar una cita confirmada, la lista de espera ofrece el hueco a pacientes en cola.",
        ],
      },
      {
        id: "ficha-clinica",
        titulo: "Ficha clínica del paciente",
        descripcion: "Datos, antecedentes, alergias, medicación, timeline de consultas y consentimientos.",
        roles: ["owner", "doctor", "assistant"],
        captura: "/guia/ficha.png",
        pasos: [
          "Abre Pacientes y elige al paciente (o búscalo con Ctrl K).",
          "En la ficha: datos de contacto, antecedentes, alergias (badge visible en toda la app), medicación, pagos y citas.",
          "El timeline de consultas reúne las citas del paciente y las notas clínicas de cada atención.",
          "Adjunta resultados o fotos en la sección correspondiente y registra los consentimientos firmados; el asistente puede subir adjuntos.",
        ],
        tip: "Los datos clínicos solo los editan roles con permiso clínico (Dueño/a y Médico).",
      },
    ],
  },
  {
    id: "caja",
    icono: "wallet",
    titulo: "Caja y cobros",
    descripcion: "Registra pagos, cuadra el día y concilia los pagos QR de tus pacientes.",
    guias: [
      {
        id: "registrar-pago",
        titulo: "Registrar un pago en caja",
        descripcion: "Yape, Plin, efectivo o POS. El total del día se cuadra solo.",
        roles: ["owner", "receptionist"],
        captura: "/guia/caja.png",
        pasos: [
          "Abre Caja del día y pulsa Registrar pago: elige el paciente o la cita atendida.",
          "Ingresa el monto y el método: Yape, Plin, efectivo, tarjeta POS o seguro.",
          "Añade la referencia u operación del pago para cuadrar con tu billetera o POS.",
          "Al cerrar el día, usa Cierre de caja: la app compara lo registrado contra lo que debería haber, y muestra la diferencia.",
        ],
      },
      {
        id: "anular-pago",
        titulo: "Anular un pago (corrección contable)",
        descripcion: "Reversa un mal registro sin borrar el rastro.",
        roles: ["owner", "receptionist"],
        pasos: [
          "En Caja del día, abre el pago y elige Anular.",
          "Escribe el motivo (mínimo 3 caracteres): queda en la auditoría.",
          "El pago anulado sale del total del día y sus cuotas vuelven a pendiente si las hubiera.",
        ],
        tip: "Anular nunca borra el registro: siempre queda el motivo y el usuario que lo hizo en Auditoría.",
      },
      {
        id: "conciliar-qr",
        titulo: "Conciliar pagos QR (Yape/Plin)",
        descripcion: "Cuando un paciente paga desde su portal con QR, el pago queda “por conciliar”.",
        roles: ["owner", "receptionist"],
        captura: "/guia/cuotas.png",
        pasos: [
          "Abre Negocios → Pagos por conciliar: ahí aparecen los pagos QR pendientes.",
          "Verifica que el monto y la referencia coincidan con tu billetera Yape/Plin o tu cuenta Plin.",
          "Pulsa Confirmar para validarlo (la cuota queda pagada) o Rechazar si no llega el dinero.",
          "Mientras no se concilie, el pago NO cuenta en la caja del día: es dinero aún sin verificar.",
        ],
      },
      {
        id: "split-seguro",
        titulo: "Split con aseguradora (EPS/seguro)",
        descripcion: "Divide un pago entre el paciente y su seguro en un clic.",
        roles: ["owner", "receptionist"],
        pasos: [
          "Registra el pago con el método Seguro y elige la cobertura del paciente.",
          "Usa el split de aseguradora: indicas qué porcentaje o monto cubre el seguro y qué paga el paciente.",
          "Cada parte queda como movimiento separado para la facturación con la aseguradora.",
        ],
      },
    ],
  },
  {
    id: "fiscal",
    icono: "receipt",
    titulo: "Comprobantes electrónicos (SUNAT)",
    descripcion: "Boletas, facturas y notas conectadas a SUNAT, con XML, CDR y PDF con QR.",
    guias: [
      {
        id: "config-fiscal",
        titulo: "Configura la facturación electrónica",
        descripcion: "RUC, Clave SOL y certificado digital, cifrados en la base de datos.",
        roles: ["owner"],
        captura: "/guia/config-fiscal.png",
        pasos: [
          "Abre Configuración → Facturación.",
          "Elige el modo: Emisión electrónica (SUNAT) o Manual.",
          "Completa RUC, usuario SOL y Clave SOL; sube tu certificado digital en formato .key/.pem.",
          "Tus credenciales se guardan cifradas y se usan solo para firmar los envíos a SUNAT.",
        ],
        tip: "Empieza en ambiente Beta para probar sin riesgos y cambia a Producción cuando SUNAT acepta tus comprobantes de prueba.",
      },
      {
        id: "emitir",
        titulo: "Emitir boleta o factura",
        descripcion: "Genera el comprobante sobre un pago, con envío automático a SUNAT.",
        roles: ["owner", "receptionist"],
        captura: "/guia/comprobantes.png",
        pasos: [
          "Abre Negocios → Comprobantes y pulsa Emitir sobre el pago.",
          "Elige boleta o factura, revisa la serie y correlativo sugeridos y confirma.",
          "La app envía el comprobante a SUNAT; el estado pasa a Aceptado (o Pendiente si SUNAT aún procesa).",
          "Descarga el PDF con QR y el XML/CDR cuando quieras; también el paciente lo ve en su portal.",
        ],
      },
      {
        id: "baja",
        titulo: "Dar de baja un comprobante",
        descripcion: "Anula un comprobante aceptado por SUNAT, con registro contable.",
        roles: ["owner", "receptionist"],
        pasos: [
          "En Comprobantes, abre el comprobante aceptado y pulsa Dar de baja.",
          "Escribe el motivo. Las boletas recientes van por Comunicación de Baja; facturas y boletas antiguas por Nota de Crédito.",
          "El estado queda Baja pendiente y se resuelve solo cuando SUNAT procesa el ticket.",
        ],
        tip: "La baja solo aplica a comprobantes Aceptados; si SUNAT lo rechazó primero, no se da de baja.",
      },
    ],
  },
  {
    id: "pacientes",
    icono: "users",
    titulo: "Portal del paciente y comunicación",
    descripcion: "Enlaces privados sin cuenta, cuotas, recall y campañas.",
    guias: [
      {
        id: "portal-paciente",
        titulo: "El portal de tu paciente",
        descripcion: "Cada paciente tiene un enlace privado de 30 días con toda su información.",
        roles: ["owner", "receptionist"],
        captura: "/guia/portal.png",
        pasos: [
          "El portal se genera automáticamente para cada paciente al enviarle un correo o mensaje.",
          "Ahí ve: sus próximas citas e historial, cuotas pendientes (con opción de pagar por QR), comprobantes descargables y sus consentimientos.",
          "Puede pagar cuotas por QR sin ir a la clínica; el pago entra a Pagos por conciliar.",
          "El enlace es personal y expira a los 30 días por seguridad; puedes enviarlo de nuevo cuando quieras.",
        ],
      },
      {
        id: "recall",
        titulo: "Recall de pacientes dormidos",
        descripcion: "Reactiva a los pacientes que no vienen en meses con un recordatorio.",
        roles: ["owner", "receptionist"],
        captura: "/guia/recall.png",
        pasos: [
          "Abre Negocios → Recall: la app calcula automáticamente pacientes dormidos (más de 6 meses) y en riesgo (4-5 meses).",
          "Pulsa Recordar en cada fila para enviar el mensaje de reactivación (correo o WhatsApp si lo configuraste).",
          "El sistema reintenta automáticamente los envíos fallidos.",
        ],
      },
      {
        id: "campanas",
        titulo: "Campañas de cumpleaños y reactivación",
        descripcion: "Mensajes programados para fechas especiales.",
        roles: ["owner", "receptionist"],
        pasos: [
          "Abre Negocios → Campañas y crea una de cumpleaños o reactivación.",
          "Elige el canal (correo y/o WhatsApp) y el texto.",
          "Actívala y la app la ejecuta en su cronograma; los resultados quedan en la auditoría.",
        ],
      },
    ],
  },
  {
    id: "canales",
    icono: "message",
    titulo: "WhatsApp, reseñas y legal",
    descripcion: "Canales de comunicación y cumplimiento normativo.",
    guias: [
      {
        id: "whatsapp",
        titulo: "Conecta WhatsApp (Cloud API)",
        descripcion: "Respuestas automáticas de citas y plantillas oficiales de Meta.",
        roles: ["owner"],
        pasos: [
          "Necesitas una cuenta Meta Business y una línea de WhatsApp API.",
          "En Configuración → WhatsApp pega tu Phone Number ID y token de acceso (se guardan cifrados).",
          "Configura la dirección del webhook en tu panel de Meta con la URL que te muestra la app.",
          "La política de respuesta (silent/single/full) controla cuántos mensajes envía el bot por interacción.",
        ],
        tip: "El modo “single” responde un solo mensaje con el enlace web: toda la conversación ocurre gratis en la web y ahorras costos por mensaje.",
      },
      {
        id: "resenas",
        titulo: "Reseñas de Google tras la consulta",
        descripcion: "Configura tu perfil de Google Business para pedir valoraciones.",
        roles: ["owner", "receptionist"],
        pasos: [
          "En Reseñas de Google, pega el enlace de reseña de tu perfil de Google Business.",
          "Activa la reseña automática: tras cada cita atendida se envía un mensaje con el enlace de reseña.",
          "Sigue las reseñas pendientes desde la misma página.",
        ],
      },
      {
        id: "arco",
        titulo: "Solicitudes ARCO (Ley 29733)",
        descripcion: "Atiende solicitudes de acceso, rectificación, cancelación u oposición.",
        roles: ["owner"],
        pasos: [
          "Los pacientes pueden solicitar sus derechos ARCO por los canales de contacto legales.",
          "En Auditoría y ARCO registras la solicitud: acceso, rectificación, cancelación u oposición de datos.",
          "Genera el paquete de datos del paciente en un clic para responder las solicitudes de acceso o portabilidad.",
          "Atiende o rechaza con motivo dentro de los plazos legales.",
        ],
      },
    ],
  },
];

export function guiasParaRol(rol: StaffRole): GuiaSeccion[] {
  return GUIAS.map((seccion) => ({
    ...seccion,
    guias: seccion.guias.filter((g) => g.roles.includes(rol)),
  })).filter((seccion) => seccion.guias.length > 0);
}
