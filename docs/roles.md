# Roles, permisos y diseño por superficie

## Actores y dispositivos

| Rol | Dispositivo | Qué hace | Vista |
|---|---|---|---|
| owner/gerente (Dueño) | PC + celular | Caja, reportes, config, personal, plan, auditoría | Consola completa PC-first + dashboard móvil |
| recepcionista | PC | Agenda citas, check-in, triaje inicial, cobra, cuadra caja | Calendario denso + cola espera + caja (alta densidad) |
| asistente/enfermería | Celular | Toma datos, prepara paciente, signos vitales, notas, adjuntos | Móvil: ficha rápida + botones de estado grandes |
| doctor | Celular/tablet | SU agenda, lee ficha, notas clínicas SOAP, CIE-10, órdenes | Móvil limpio: agenda→paciente actual→ficha/notas |
| patient (Paciente) | Celular | Reserva, reprograma, cancela, ve resultados/citas/recibos | Público, sin cuenta, link mágico |

**Roles nuevos planificados por ola** (se añaden en el enum `role` y en
`packages/core/src/permissions.ts` cuando su módulo exista):

| Rol nuevo | Ola | Qué hace |
|---|---|---|
| laboratorista | OLA 2 | Toma de muestras, procesar, validar y liberar resultados |
| farmacia | OLA 2 | Dispensación de órdenes médicas, kardex, lotes FEFO |
| director medico | OLA 2-4 | Dashboard directivo, auditoría de historia clínica (solo lectura auditada) |

## Matriz de permisos (heredada de odontoflow/packages/core, permissions.ts)

| Acción | Dueño/gerente | Recepción | Asistente/enfermería | Doctor |
|---|---|---|---|---|
| Ver agenda completa | ✅ | ✅ | ✅ (solo estados) | Solo la suya |
| Crear/editar/cancelar citas | ✅ | ✅ | ❌ | Solo propias |
| Check-in / sala de espera | ✅ | ✅ | ✅ | ❌ |
| Crear/editar datos paciente | ✅ | ✅ | ✅ | ✅ |
| Ver/editar ficha clínica | ✅ | Solo contacto | Parcial (alergias, signos) | ✅ |
| Registrar pagos / caja | ✅ | ✅ | ❌ | ❌ |
| Ver ingresos/reportes | ✅ todo | Solo cierre diario | ❌ | Opcional (flag dueño) |
| Enviar recordatorios | ✅ | ✅ | ❌ | ❌ |
| Gestionar personal/horarios | ✅ | ❌ | ❌ | ❌ |
| Configurar servicios/precios | ✅ | ❌ | ❌ | ❌ |
| Emitir comprobantes | ✅ | ✅ | ❌ | ❌ |
| Auditar lectura de historia | ✅ (solo él) | ❌ | ❌ | ❌ |

Por defecto: asistente/enfermería = datos + estados, SIN caja ni precios.
(En clínicas pequeñas el dueño puede elevarlo a recepcionista.)

## Horario laboral / turno
- Cada miembro: `staff_schedules` (día_semana, hora_ini, hora_fin).
- Flag por tenant `restringir_fuera_horario`: si activo, fuera del turno no puede iniciar sesión.
- Registrar actividad por turno (audit).

## Privacidad del paciente (whitelist estricta)

El paciente SÍ ve: logo/nombre de la clínica, catálogo de prestaciones y precios,
horarios generales, su solicitud de cita y su confirmación, su link mágico, sus
resultados de laboratorio/imagen (token), sus recibos.

El paciente NO ve: lista de otros pacientes, horario real/calendario del doctor,
presencia del doctor (si está hoy o no), ocupación real de camas/consultorios,
doctor asignado hasta confirmar, notas internas, sala de espera, dashboard
directivo, auditoría.

→ El tablero sala de espera y la ocupación de camas son SOLO internos.

## Nuevo requisito institucional: auditoría de acceso a la historia clínica

La historia clínica es **dato sensible** bajo la Ley 29733. Toda lectura de la
ficha de un paciente debe quedar registrada:

- Toda consulta/lectura de la ficha → fila en `audit_logs`
  (`accion: "ficha.leer"`, quién, cuándo, paciente, endpoint).
- Visor "historia vista por" (solo gerente/owner en `/consola/auditoria`):
  lista lecturas de ficha con filtros por paciente/período, exporta CSV.
- Sinexceptions: el panel `/admin` de la plataforma también queda auditado.

## Flujo de reserva (modelo solicitud→confirmación, por defecto)

1. Paciente entra a r.<dominio>/<clinica>
2. Wizard 3 pasos: prestación → fecha/franja + preferencia de doctor (sin agenda) → datos + consentimiento
3. Envía solicitud (estado `solicitada`)
4. Recepción la ve en cola "Solicitudes", aprueba/ajusta, asigna doctor+consultorio+hora → estado `confirmada`
5. Paciente recibe confirmación (email) con hora exacta + link mágico

Modo alternativo: `booking_mode = instantaneo` (la clínica oferta slots públicos
limitados; aun así sin ver lista de otros pacientes ni ocupación).

## Workflow canónico de una cita (consulta externa)

1. Recepcionista crea/confirma la cita (doctor + consultorio)
2. Recordatorio automático día anterior (email; WhatsApp add-on OLA 4)
3. Paciente llega → check-in → sala de espera
4. **Triaje** (asistente/enfermería): signos vitales → pasa a espera de consulta
5. Doctor ve "mi siguiente", lee ficha (queda en audit), atiende,
   escribe nota SOAP + diagnóstico CIE-10 + órdenes de laboratorio/imagen
6. Doctor marca "atendido" → vuelve a recepción/caja
7. Recepción cobra (Yape/Plin/efectivo/POS) + agenda próxima → cierre diario
8. Gerente ve en dashboard: citas día, ingresos, no-shows, ocupación

## Diseño UI (anti-genérico)

- Paleta: teal clínico (#0F766E primario) + neutros cálidos. NO gris frío típico.
- Estados cita: pendiente ámbar · confirmada azul · en-espera violeta · atendida verde · no-show rojo
- Tipografía Inter/Geist; tabular-nums para montos/horas
- Densidad adaptativa: recepción PC densa; doctor/asistente móvil cards + botones ≥48px
- Español desde día 1 ("Caja", "Sala de espera", "Agenda del día", "Hospitalización")
- Componentes: shadcn/ui + Tailwind + Radix (MIT)
- Empty states con CTA; optimistic UI + toasts; command palette (Ctrl+K)

## Superficies (estructura de rutas en apps/web)

```
/public/[clinica]/reserva     → página pública paciente (sin auth)
/consola/(por rol)            → app.<dominio>
   /consola                   → dashboard según rol
   /consola/agenda            → recepción/doctor (recursos: doctor + consultorio)
   /consola/sala-espera       → recepción/asistente (tiempo real, triaje)
   /consola/pacientes         → todos (según permisos)
   /consola/caja              → recepción/dueño
   /consola/dashboard         → director médico/gerente
   /consola/auditoria         → dueño/gerente ("historia vista por")
   /consola/personal          → dueño
   /consola/solicitudes       → recepción (cola de solicitudes)
/admin                        → operador del SaaS (nosotros)
```
