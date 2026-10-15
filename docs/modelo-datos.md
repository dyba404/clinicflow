# Modelo de datos

Convención: TODA tabla de dominio lleva `tenant_id` (= teams.id). Índices por
tenant_id. Estado descrito: esquema **portado real** en
`packages/db/src/schema.ts` (44 tablas). Marcas por destino:

- **[H]** núcleo heredado vigente — se usa tal cual desde OLA 0
- **[D]** dental: destinar/eliminar por ola (columna: destino)

## Tablas portadas (estado actual del schema)

### Plataforma y acceso

| Tabla | Propósito | Destino |
|---|---|---|
| `users` | Usuarios globales (email único, hash scrypt, `is_platform_admin`, `locked_at`, `must_change_password`) | [H] |
| `teams` | Tenant/clínica: slug, timezone, `booking_mode`, `restringir_fuera_horario`, Google reviews | [H] |
| `memberships` | Vínculo user×team con `role` (owner/receptionist/assistant/doctor) + active | [H] — ampliar enum con roles nuevos por ola |
| `invitations` | Invitaciones de personal por token con expiración | [H] |
| `sessions` | Sesiones (8h), `impersonated_by_user_id` para soporte | [H] |
| `password_resets` | Tokens de recuperación | [H] |
| `impersonation_requests` | Impersonación auditada (1 uso, 15 min) | [H] |
| `staff_schedules` | Turnos por miembro (día_semana, hora_ini/fin) | [H] |
| `audit_logs` | Auditoría: acción/entidad/ip/payload — aquí va además la lectura de ficha (Ley 29733) | [H] |

### Núcleo operativo

| Tabla | Propósito | Destino |
|---|---|---|
| `patients` | Ficha persona: nombre, celular, email, documento, fnac, alergias, antecedentes, medicación, gestación, activo (soft-delete ARCO) | [H] — ficha multi-especialidad en OLA 1 |
| `services` | Catálogo de prestaciones: nombre, duracion_min, precio, buffer, codigo_procedimiento | [H] — "servicio" → prestación clínica |
| `branches` | Sucursales (unique tenant+slug) | [H] |
| `appointments` | Citas: service/patient/doctor/preferred_doctor, fecha, hora_ini/fin, estado (7 estados), monto/monto_pagado | [H] — recursos doctor+consultorio en OLA 1 |
| `blocked_slots` | Bloqueos de agenda | [H] |
| `clinical_records` | Notas clínicas por cita (nota + adjuntos) | [H] — evoluciona a SOAP + CIE-10 en OLA 1 |
| `tooth_states` | Odontograma FDI por diente | [D] → **eliminar en OLA 1** (port fuera dental) |
| `attachments` | Adjuntos (rx/consentimiento/otro) + foto_tipo/foto_orden/tratamiento | [H] — "rx" → adjuntos de imagen clínica; fotos antes/después → reducir |
| `signed_consents` | Consentimientos canvas→PDF | [H] — obligaciones y consentimientos médicos (OLA 1) |
| `patient_magic_tokens` | Links mágicos del paciente (sin cuenta) | [H] |

### Caja y fiscal

| Tabla | Propósito | Destino |
|---|---|---|
| `payments` | Pagos: monto, método (yape/plin/efectivo/tarjeta_pos/tarjeta_online/otro), estado valido/anulado + motivo, `caja_cerrada` | [H] |
| `cash_closures` | Cierre diario: apertura, cierre real vs sistema, diferencia, estado cerrado/reabierto | [H] |
| `vat_settings` | Fiscal por tenant: RUC, régimen, ambiente SUNAT, Clave SOL/certificado cifrados, series/correlativos, modo manual/electronica | [H] |
| `receipts` | Comprobantes: tipo, serie, correlativo, `sunat_estado` (8 estados), hash/CDR/XML/PDF, `afectado_id` | [H] |
| `insurers` | Aseguradoras/convenios: nombre, RUC, teléfono | [D port] → **convenios/aseguradoras institucionales en OLA 3** |
| `patient_coverages` | Cobertura por paciente: plan, copago_pct, vigencia | [D port] → convenios del paciente en OLA 3 |

### Suscripción y notificaciones

| Tabla | Propósito | Destino |
|---|---|---|
| `subscriptions` | Plan pagado a nosotros (free/pro/premium), estado, vence, método (manual) | [H] — remapear a Standard/Pro/Premium comerciales |
| `notification_settings` | Recordatorios on/off + plantilla WhatsApp + idioma | [H] |
| `reminders` | Recordatorios (24h, confirmación, recall, reprogramación, waitlist): canal, estado | [H] |
| `whatsapp_settings` | WhatsApp Cloud API por tenant (phone_number_id, token cifrado) | [H] — solo add-on OLA 4 |
| `whatsapp_messages` | Bandeja de mensajes entrantes/salientes | [H] — solo add-on OLA 4 |
| `waitlists` | Lista de espera anti-huecos | [H] reutilizable tal cual |
| `review_requests` | Reseñas Google post-consulta | [H] reutilizable tal cual (clínicas privadas también) |
| `campaigns` | Campañas cumple/reactivación | [H] reutilizable tal cual |

### Inventario, laboratorio, presupuestos, comisiones

| Tabla | Propósito | Destino |
|---|---|---|
| `inventory_items` | Items con stock/stock_min/costo_unit | [D port] → **farmacia en OLA 2** (fármacos e insumos) |
| `inventory_lots` | Lotes con vencimiento | [D port] → farmacia FEFO en OLA 2 |
| `stock_movements` | Kardex (ingreso/consumo/ajuste/merma) | [D port] → farmacia en OLA 2 |
| `service_materials` | Receta de materiales por servicio | [D port] → **receta/dispensación ligada a orden médica en OLA 2** |
| `lab_orders` | Laboratorio/protésico dental (enviado→fabricacion→recibido→colocado) | [D] → **reemplazar por órdenes clínicas en OLA 2** (`lab_orders_clinica`) |
| `quotes` | Presupuestos de tratamiento (items jsonb, total, expira) | [H port] → cotización de tratamiento con cuotas |
| `installments` | Cuotas (n, monto, pagado, vence, estado, payment_id) | [H port] → cuotas del tratamiento |
| `commission_settings` | % comisión por membership | [H] |
| `commission_entries` | Comisión por pago (unique pago+doctor) | [H] |

### Legal y datos personales

| Tabla | Propósito | Destino |
|---|---|---|
| `legal_settings` | Responsable Ley 29733 por tenant (razón social, RUC, contacto ARCO, textos editables) | [H] |
| `data_requests` | Solicitudes ARCO (información/rectificación/cancelación/oposición) | [H] — reforzado: historia clínica dato sensible |

## Tablas planificadas por ola

### OLA 1 — consulta externa

| Tabla | Propósito |
|---|---|
| `cie10` | Catálogo CIE-10 cargado de fuente MINSA (código, descripción, categoría) — sin tenant_id (global) |
| `diagnoses` | Diagnósticos aplicados por consulta (patient_id, appointment_id, cie10_id, principal/secundario, creado_por) |
| `consultoria` (columnas) | Nota SOAP en `clinical_records` (payload) + órdenes referidas |
| `consulting_rooms` | Consultorios como recursos de agenda (nombre, tenant_id, activo) |

### OLA 2 — diagnóstico + hospitalización

| Tabla | Propósito |
|---|---|
| `admissions` | Admisiones: patient_id, servicio, motivo, estado, fecha_ingreso/egreso, epicrisis |
| `beds` | Camas por tenant: id, servicio/ala, estado (libre/ocupada/limpieza/mantenimiento) |
| `bed_assignments` | Asignaciones patient×cama con fecha_ini/fin (transferencias crean filas nuevas) |
| `nursing_shifts` | Turnos de enfermería (membership, día, turno mañana/tarde/noche) |
| `vital_signs` | Signos vitales como observaciones (patient_id, turno, PA/FC/FR/Temp/SpO2, registrado_por) |
| `lab_orders_clinica` | Ódenes clínicas: patient_id, doctor_id, estudio, prioridad, estado (ordenada/tomada/procesada/validada/liberada/entregada) |
| `lab_results` | Resultados por parámetro: orden_id, parámetro, valor, unidad, rango_referencia, flag (normal/alto/bajo) |
| `imaging_orders` | Ódenes de imagen: estudio, estado (ordenada/informada/entregada) |
| `imaging_reports` | Informes radiológicos (texto + firmado_por) |
| `dispenses` | Dispensaciones farmacia: orden médica, item/lote FEFO, cantidad, devoluciones |

### OLA 3 — cirugía + UCI

| Tabla | Propósito |
|---|---|
| `surgeries` | Cirugías programadas: patient_id, procedimiento, sala, equipo, estado, checklist pre-op |
| `anesthesia_records` | Clasificación ASA + registro de anestesia (inducción/mantenimiento/despertar) |
| `intraop_records` | Registro intraoperatorio (inicio/fin, complicaciones, equipo) |
| `urpa_records` | Recuperación post-anestésica: ingreso/salida URPA, destino (piso/egreso) |
| `icu_stays` | Estancias UCI simplificadas |
| `icu_balance` | Hoja de balance hídrico por turno (ingresos/egresos) |

## Reglas de negocio clave
- Multi-tenancy: toda query filtra tenant_id; middleware valida membership+role+turno.
- Lectura de ficha → `audit_logs` (Ley 29733, dato sensible); visor solo gerente.
- Doctor puede pertenecer a varios tenants con rol doctor.
- Offboarding: revocar acceso inmediato (los datos viven en el sistema, no en el aparato).
- Cifrado en tránsito (TLS) + at-rest para certificados/Clave SOL/tokens WhatsApp.
