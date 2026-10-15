# Módulos — topología por módulo

Estado a OLA 0 (2026-08-19): capa horizontal heredada de odontoflow v1.6.2 y portada.
"HEREDADO" = funcionando en el workspace tras el port; "OLA n" = planificado en esa ola.
Esquema multi-tenant: toda tabla lleva `tenant_id` (= teams.id) salvo catálogos
globales (cie10) o llaves 1:1 por tenant. Máquinas de estado y protocolos de
corrección: `docs/estados.md`.

```
                     ┌────────────────────────────────────────────────────┐
                     │                 apps/web (Next.js 15)              │
                     │   Consola por rol + API routes + reserva pública   │
                     └──────┬───────────┬───────────┬────────────┬────────┘
                            │           │           │            │
               ┌────────────┘           │           │            └─────────────┐
               ▼                        ▼           ▼                          ▼
        ┌─────────────┐          ┌────────────┐  ┌──────────┐          ┌──────────────┐
        │  Postgres   │          │  cron      │  │  Resend  │          │  lycet       │
        │  16 (:5433) │          │ supercronic│  │  (email) │          │  (Docker)    │
        │  (compose)  │          │ v0.2.49    │  │          │          │  :8091 dev   │
        └─────────────┘          └─────┬──────┘  └──────────┘          └──────┬───────┘
               ▲                       │                                      │
               │                       ▼                                      ▼
               │               jobs → POST /api/cron/* (Bearer CRON_SECRET)  SUNAT beta/prod
               │               recordatorios · renovaciones · fiscal          (Greenter HTTP)
               │               diario · recall · seguimiento
               │
        ┌──────┴────────────────────────────────────────────────┐
        │ Agenda/Espera · Ficha/SOAP+CIE-10 · Hospitalización   │
        │ Enfermería · Laboratorio · Imagen · Farmacia          │
        │ Quirófano · UCI · Caja/SUNAT · Portal · Dashboard     │
        │ PWA offline · Hardening                               │
        └───────────────────────────────────────────────────────┘
```

---

## 1. Agendas y espera (HEREDADO)

```
 r.<dominio>/<clinica>                    POST /api/citas/[id]/estado
   │ wizard 3 pasos                              ▲
   ▼                                             │
 solicitud (solicitada) ──▶ recepción confirma (confirmada)
   │ preferencia de doctor (sin agenda)          │
   ▼                                             ▼
 slots públicos (computeSlots: doctores +        check-in
 ventanas, buffers, multiplicidad de slots)      │
   │                                             ▼
   └─────────────────────────────────▶ sala de espera kanban (tiempo real)
                                        llamada → en_atencion → atendida
```

| Aspecto | Detalle |
|---|---|
| Tablas | `appointments` (estado, doctor, preferencia, monto, modo_solicitud), `blocked_slots`, `services` (duración + buffer), `staff_schedules` |
| Endpoints | `POST /api/solicitudes` (público, rate limit) · `GET /api/slots` · `POST /api/citas` · `POST /api/citas/[id]/estado` · `POST /api/citas/[id]/reprogramar` (drag&drop día, snap 15 min) |
| Regla | Recursos = doctor (+ consultorio en OLA 1). Multiplicidad de slots por franja. Reversibles: deshacer aceptación/check-in/llamado con toast 5s; no_show→confirmada si llegó tarde |
| Dependencia externa | Ninguna (email al confirmar vía Resend) |
| Estado | HEREDADO |

## 2. Ficha / consulta (OLA 1)

```
 paciente (ficha por persona)                 doctor en consulta
   │ datos, antecedentes, alergias,             │
   │ medicación, gestación                      ▼
   ▼                                    nota SOAP (S/O/A/P)
 historial clínico multi-especialidad      + diagnóstico CIE-10 (catalogo cie10)
   │                                      + órdenes lab/imagen (crea stubs OLA 2)
   └── toda lectura → audit_logs (Ley 29733)
   consentimientos/obligaciones: canvas → PDF (signed_consents, portado)
```

| Aspecto | Detalle |
|---|---|
| Tablas | `patients`, `clinical_records` (evoluciona a SOAP), `diagnoses` (nueva), `signed_consents`, `attachments`; sale `tooth_states` |
| Endpoints | CRUD ficha + `POST /api/pacientes/[id]/notas` · `POST /api/consultas/[id]/diagnostico` · lectura de ficha auditada |
| Regla | Odontograma eliminado. Ficha por persona dueña del modelo (una ficha, múltiples especialidades). Presupuesto/cuota se mantiene como cotización de tratamiento |
| Dependencia externa | Ninguna |
| Estado | OLA 1 (port de pacientes/ficha odontoflow + adaptación médica) |

## 3. CIE-10 (OLA 1)

```
 catálogo cie10 (fuente MINSA, sin tenant_id)      diagnóstico por consulta
   │ código · descripción · categoría                 │ appointment_id + patient_id
   ▼                                                  ▼
 búsqueda por código/descripción ──▶ diagnoses (principal | secundario)
                                     └──▶ se muestra en ficha + epicrisis + export
```

| Aspecto | Detalle |
|---|---|
| Tablas | `cie10` (global), `diagnoses` (tenant_id, cie10_id, tipo) |
| Endpoints | `GET /api/cie10?q=` (búsqueda, rate-limited en consola) · `POST /api/consultas/[id]/diagnostico` |
| Dependencia externa | Fuente MINSA para el seed (script de carga) |
| Estado | OLA 1 |

## 4. Hospitalización / camas (OLA 2)

```
 emergencia/consulta ──▶ admisión (admissions)
                             │ estado: admision → hospitalizado → egresado
                             ▼
                         pivote de camas (beds)
                             │ bed_assignments (paciente×cama, ini/fin)
                             ▼
                         evolución diaria (notas por día)
                             │
             ┌───────────────┼─────────────────┐
             ▼               ▼                 ▼
      transferencia     epicrisis (egreso)   alta (médica | voluntaria)
      de cama           PDF + firma
```

| Aspecto | Detalle |
|---|---|
| Tablas | `admissions`, `beds`, `bed_assignments`, `clinical_records` (evoluciones), epicrisis como adjunto/documento |
| Endpoints | `POST /api/hospitalizacion/admisiones` · `POST /api/hospitalizacion/camas/[id]/asignar` · `POST /api/hospitalizacion/admisiones/[id]/egreso` (exige epicrisis) |
| Regla | Cama libre→ocupada→limpieza→libre. Ocupación % al dashboard |
| Dependencia externa | Ninguna |
| Estado | OLA 2 |

## 5. Enfermería / turnos (OLA 2)

```
 hospitalizado ──▶ turno (mañana/tarde/noche, nursing_shifts)
                     │
                     ▼
                 signos vitales por turno (vital_signs)
                 PA · FC · FR · temperatura · SpO2 · responsable
                     │
                     └──▶ balance hídrico (UCI, módulo 10)
```

| Aspecto | Detalle |
|---|---|
| Tablas | `nursing_shifts`, `vital_signs` (observaciones por turno) |
| Endpoints | `POST /api/enfermeria/turnos` · `POST /api/enfermeria/vitales` (por admisión + turno) |
| Regla | Signos vitales son observaciones; cada registro con responsable + audit |
| Dependencia externa | Ninguna |
| Estado | OLA 2 |

## 6. Laboratorio clínico (OLA 2)

```
 consulta/emergencia                              referencia de flujo: openemr
   │ orden médica                                  (orden→toma→resultado→
   ▼                                               validación→liberación)
 lab_orders_clinica: ordenada → tomada → procesada → validada → liberada → entregada
   │                (retroceso de un solo paso + motivo, como lab de odontoflow)
   ▼
 lab_results (por parámetro: valor, unidad, rango de referencia, flag normal/alto/bajo)
   │
   └──▶ PDF de resultados → portal del paciente + adjunto a la ficha
```

| Aspecto | Detalle |
|---|---|
| Tablas | `lab_orders_clinica` (reemplaza `lab_orders` dental de prótesis), `lab_results` |
| Endpoints | `POST /api/laboratorio-clinico/ordenes` · `PATCH /api/laboratorio-clinico/ordenes/[id]/estado` · `POST /api/laboratorio-clinico/ordenes/[id]/resultados` |
| Regla | Retroceso de UN solo paso con motivo ≥3 (rev +1) idéntico al laboratorio portado; validar = rol laboratorista/médico; liberar abre visibilidad al portal |
| Dependencia externa | Ninguna |
| Estado | OLA 2 |

## 7. Imagen / OHIF (OLA 2; visor DICOM en backlog)

```
 consulta ──▶ imaging_orders (estudio, prioridad)
                │ ordenada → informada → entregada
                ▼
              imaging_reports (texto + firmado_por)
                │
                └──▶ adjunto PDF a la ficha + portal del paciente
                     (visor DICOM OHIF: backlog, no incluye archivos DICOM aún)
```

| Aspecto | Detalle |
|---|---|
| Tablas | `imaging_orders`, `imaging_reports`, `attachments` (PDFs de informe) |
| Endpoints | `POST /api/imagen/ordenes` · `POST /api/imagen/ordenes/[id]/informe` |
| Dependencia externa | Ninguna en OLA 2 (PDF informe); OHIF sería despliegue externo futuro |
| Estado | OLA 2 |

## 8. Farmacia (OLA 2)

```
 orden médica (hospitalización/consulta)
   │
   ▼
 dispenses: ordenada → dispensada → (devuelta)
   │ ligada a la orden médica (patient_id + prescripción)
   ▼
 kardex: stock_movements + inventory_lots (FEFO: vence ASC NULLS LAST)
   │ reutiliza módulos de inventario de odontoflow renombrados a insumos/fármacos
   ▼
 alertas stock ≤ stock_min al digest diario
```

| Aspecto | Detalle |
|---|---|
| Tablas | `inventory_items`, `inventory_lots`, `stock_movements` (renombrados a farmacia), `dispenses`, `service_materials` → prescripción/orden ligada |
| Endpoints | `POST /api/farmacia/dispensar` (valida stock FEFO) · `POST /api/farmacia/deoluciones` |
| Regla | Sin stock suficiente: la dispensación expone faltantes (no bloquea la orden médica). Devolución genera movimiento `ajuste` |
| Dependencia externa | Ninguna |
| Estado | OLA 2 |

## 9. Quirófano (OLA 3)

```
 programación de cirugía (surgeries: fecha, sala, equipo, procedimiento)
   │
   ▼
 checklist pre-op (quirúrgico/anestésico) ──▶ checklist_ok
   │
   ▼
 anestesia ASA (anesthesia_records) + registro intraop (intraop_records)
   │ inicio/fin de anestesia, equipo, complicaciones
   ▼
 URPA (urpa_records) ──▶ regreso a piso | egreso
```

| Aspecto | Detalle |
|---|---|
| Tablas | `surgeries`, `anesthesia_records`, `intraop_records`, `urpa_records` |
| Endpoints | `POST /api/quirofano/cirugias` · `POST /api/quirofano/[id]/checklist` · `PATCH /api/quirofano/[id]/estado` |
| Regla | Máquina: programada → checklist_ok → intraop → urpa → piso/egreso. Sin checklist_ok no inicia intraop |
| Dependencia externa | Ninguna |
| Estado | OLA 3 |

## 10. UCI (OLA 3)

```
 admisión UCI (icu_stays) ──▶ monitoreo continuo (vital_signs de alta frecuencia)
   │
   └──▶ hoja de balance (icu_balance por turno: ingresos/egresos hídricos)
   │
   └──▶ egreso UCI → piso (vía admisión/hospitalización)
```

| Aspecto | Detalle |
|---|---|
| Tablas | `icu_stays`, `icu_balance`; reutiliza `vital_signs` |
| Endpoints | `POST /api/uci/estancias` · `POST /api/uci/balance` |
| Regla | UCI simplificada: monitoreo + hoja de balance; sin integración con dispositivos |
| Dependencia externa | Ninguna |
| Estado | OLA 3 |

## 11. Caja + comprobantes SUNAT (HEREDADO — port de odontoflow §1/§2b)

```
 POST /api/caja/pagos            ──▶ payments.estado valido (default)
 POST /api/caja/pagos/[id]/anular ──▶ anulado (motivo ≥3; nunca borrado físico)
      bloqueo: comprobante SUNAT aceptado → 409 (primero baja)
 POST /api/caja/cierre           ──▶ cash_closures cerrado
 POST /api/caja/cierre/[id]/reabrir ──▶ reabierto (solo owner) + nuevo cierre

 emisión electrónica: apps/web ──lib/lycet.ts──▶ http://lycet:8091/api/v1/* ──▶ SUNAT
 receipts.sunat_estado: manual|pendiente_envio|aceptado|rechazado|baja_* (8 estados)
 baja: boleta vía RA · factura por nota de crédito 07 (verificado 2026-08)
 vat_settings: cada tenant con SU ruc/certificado/Clave SOL (LOCAL_MASTER_KEY)
```

| Aspecto | Detalle |
|---|---|
| Tablas | `payments` (estado + anulación), `cash_closures` (cerrado/reabierto), `vat_settings` (1:1 tenant, cifrado), `receipts` (sunat_estado, xml/cdr/pdf, afectado_id) |
| Endpoints | `POST/PATCH/DELETE /api/caja/*` · `POST /api/caja/comprobantes/[id]/emitir` y `/baja` (boleta RA / factura nota 07) · `GET /api/fiscal/archivo/*` |
| Regla | Anulación contable + exclusión de anulados en totales/cierre. Modo `manual` funciona sin sidecar. Export registro de ventas mensual |
| Dependencia externa | Sidecar lycet + RUC/certificado/Clave SOL **del tenant** |
| Estado | HEREDADO (verificado contra SUNAT beta real) |

## 12. Portal del paciente (HEREDADO base; ampliado en OLA 4)

```
 token mágico (patient_magic_tokens, 30 días, sin cuentas)
   │
   ├──▶ hoy: citas/historial, cuotas, comprobantes aceptados (PDF/XML/CDR),
   │        presupuesto, consentimientos, confirmar asistencia
   └──▶ OLA 4: + resultados de laboratorio/imágenes liberados, recibos
   propiedad estricta: ownership receipt→payment→patient (404 en ajeno)
```

| Aspecto | Detalle |
|---|---|
| Tablas | `patient_magic_tokens`, `appointments`, `installments`, `receipts`, `quotes`, `signed_consents`; en OLA 4 + `lab_results`/`imaging_reports` (solo liberados) |
| Endpoints | `/public/[clinica]/portal/[token]/*` · `GET /api/portal/*` con validación de propiedad |
| Regla | Whitelist estricta (ver roles). Nada de lista/agenda/ocupación. Resultados solo tras `liberada` |
| Dependencia externa | Ninguna |
| Estado | HEREDADO base; OLA 4 amplía |

## 13. Dashboard del director (OLA 4)

```
 fuentes: appointments · admissions · payments · services · lab_orders_clinica
   │
   ▼
 KPIs directivos:
   cama ocupada % · top procedimientos · ticket promedio · tiempo de espera
   (+ heredados: ingresos por método/doctor, no-shows, ocupación de agenda)
   │
   └──▶ vista por período (día/semana/mes) · export CSV
```

| Aspecto | Detalle |
|---|---|
| Tablas | Consultas agregadas sobre tablas existentes (sin tabla propia) |
| Endpoints | `GET /api/dashboard/director?periodo=` (permiso owner/director medico) |
| Dependencia externa | Ninguna |
| Estado | OLA 4 (dashboard de ganancias del owner es HEREDADO) |

## 14. PWA offline (HEREDADO)

```
 apps/web
   ├── manifest.webmanifest + iconos PNG (instalable, standalone)
   ├── sw.js: navigations network-first + fallback offline.html;
   │          /_next/static e iconos cache-first; sin caché de HTML
   ├── components/pwa/*: registro solo en producción + banner offline
   ├── install-banner: pointer:coarse, descarte por sesión, pasos iOS/Android
   └── lib/offline-store.ts: IndexedDB (borradores de nota clínica)
```

| Aspecto | Detalle |
|---|---|
| Alcance real | Instalable, fallback offline, caché de assets, banner sin conexión, borradores IndexedDB. Cacheo/replay de agenda: mejora futura |
| Dependencia externa | Ninguna |
| Estado | HEREDADO |

## 15. Hardening / rate limits (HEREDADO)

```
 middleware.ts (edge-safe, solo headers) → HSTS, nosniff, referrer, frame-deny,
                                           permissions-policy en /api/*
 rate limiting in-memory (lib/rate-limit.ts):
   login 10/min · signup 5/min · recuperar 5/min · solicitudes públicas 10/min
   slots 60/min · webhook WhatsApp 30/min → 429 + Retry-After
 GET /api/health → SELECT 1 (timeout 3s) → 200/503
 backup: cron contenedor, pg_dump 03:40 Lima, retención 30 días
 secrets fail-closed: ${VAR:?} en compose prod; cron 401 sin CRON_SECRET
```

| Aspecto | Detalle |
|---|---|
| Archivos | `src/middleware.ts`, `api/health/route.ts`, `lib/rate-limit.ts`, `docker/cron/backup-db.sh` |
| Refuerzo OLA 4 | Verificar backup restaurado + compose portable en VPS destino |
| Dependencia externa | Ninguna |
| Estado | HEREDADO |
