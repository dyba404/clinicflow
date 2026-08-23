# Roadmap por olas

Regla: cada ola es **instalable y vendible**. En cada ola: ship → vender → medir antes
de construir la siguiente. No se avanza de ola sin haber vendido la anterior.

La capa horizontal (tenancy, auth, agenda, caja, SUNAT, portal, PWA, compose) viene
portada de odontoflow v1.6.2 y se considera activa desde OLA 0; su historial completo
queda en el repo original. Aquí solo se registra lo de clinicflow.

## [x] OLA 0 — Repo y port de la capa horizontal (Sesión 1, 2026-08-19)

- [x] Creación del repo clinicflow a partir de odontoflow v1.6.2
- [x] Port de la capa horizontal: 223 archivos renombrados byte-safe UTF-8 (0 mojibake)
- [x] Puertos dev separados del odontoflow que sigue corriendo en la misma máquina:
      clinicflow = 5433 BD · 3112 app/sidecar · 8091 lycet · 1026/8026 Mailpit · 3011 whatsmock;
      odontoflow retiene 5432 / 3111 / 8090 / 1025 / 8025 / 3010
- [x] Contenedores renombrados: clinicflow-db, clinicflow-lycet, clinicflow-mailpit, clinicflow-whatsmock
- [x] `.references/` clonadas en clinicflow/.references:
      medplum (Apache-2.0) → modelo FHIR para extracción de diseño de esquema, scheduling y access-policy
      openemr (GPL-3.0) → referencia de flujo de lectura clínica (orden→toma→resultado→validación→liberación, patient_tracker, SQL)
      openmrs → referencia Visita / Encuentro / Obs / Ubicación
      lycet / greenter / whap → fiscal y WhatsApp (copiados como estaban)
- [x] Docs reescritas para clinicflow (archivos 00-06); 10 y 99 los mantiene otro agente
- [x] `npm install` limpio
- [x] npm install / typecheck / lint verificado (Gate OLA 0, ver 99-sesion-estado)

**Salida:** workspace clinicflow corre sin tocar odontoflow; listo para OLA 1.

---

## [x] OLA 1 — Núcleo de consulta externa (Sesión 2, 2026-08-20)

Objetivo: una clínica que solo hace consulta externa puede operar todo su día.
Puerta de venta: la clínica ve agenda + historia CIE-10 + laboratorio/imagen ordenados
y cobra/factura igual que hoy.

- [x] Ficha de paciente médico (sin odontograma), antecedentes/alergias/medicación
- [x] Catálogo CIE-10 (ICD-10-CM 2026, 98,186 códigos) + diagnósticos por consulta
- [x] Sala de espera con triaje (leve/moderado/urgente)
- [x] Consulta con nota SOAP + diagnósticos CIE-10 + recetas
- [x] Órdenes de laboratorio/imagen desde la consulta
- [x] Auditoría "historia vista por" (Ley 29733)

**Salida OLA 1:** demo vendible "solo consulta externa". Gate VERDE (14/14 E2E).

---

## [x] OLA 2 — Diagnóstico + hospitalización (Sesión 3, 2026-08-20)

Objetivo: clínicas con internamiento corto (20-100 camas) y sus servicios de apoyo.

- [x] Hospitalización: admisión, camas (asignar/transferir/liberar), evoluciones,
      epicrisis al egreso, alta médica/voluntaria, abandono
- [x] Signos vitales por turno (mañana/tarde/noche) con rangos clínicos validados
- [x] Laboratorio clínico: orden→toma→procesada→validada→liberada→entregada,
      resultados por parámetro con rango, PDF de resultados
- [x] Farmacia interna FEFO (dispensación ligada a stock/lotes)

**Salida OLA 2:** hospitalización corta operativa + laboratorio/farmacia en línea.

---

## [x] OLA 3 — Cirugía + institucional (Sesión 4, 2026-08-20)

- [x] Quirófano: programación, salas, checklist preop 6 ítems, ASA, registro
      intraoperatorio, URPA, Gantt por sala
- [x] UCI simplificada: estancias, balance hídrico, egreso
- [x] Facturación institucional: facturas por admisión con ítems, convenios
      (EPS/seguro) con descuento, estados borrador→emitida→pagada|anulada

**Salida OLA 3:** clínicas con quirófano y UCI. Gate VERDE (14/14 E2E).

---

## [x] OLA 4 — Portal + hardening (2 agentes)

### Agente 4.1 — Portal del paciente
- [x] Resultados de laboratorio e imagen disponibles al paciente
- [x] Citas (confirmar/reprogramar/cancelar como en odontoflow)
- [x] Recibos/SUNAT de su cuenta
- [x] Se mantiene portal passwordless por token (heredado)

### Agente 4.2 — Dashboard director + E2E + auditoría + hardening
- [x] Dashboard del director médico / gerente: ocupación de cama %, top procedimientos,
      ticket promedio, tiempo de espera
- [x] E2E con matriz RBAC + flujo global completo:
      reserva→consulta→hospitalización→orden→resultado→egreso→facturación→SUNAT
- [x] Visor "historia vista por" para auditoría (Ley 29733 dato sensible):
      toda lectura de ficha → `audit_logs`, visible solo al gerente/owner
- [x] Secrets fail-closed verificados; backup restaurado probado; compose prod
      verificado como portable a VPS

**Salida OLA 4:** producto terminado para venta escalada; 5-10 clínicas objetivo.

---

## [x] OLA 5 — Portal serio + SaaS maduro (Sesiones 5-6, 2026-08-21/22)

- [x] Portal del paciente con login (celular + contraseña + slug de clínica),
      activación desde la ficha, resultados publicados por el médico,
      representantes ("pacientes a tu cargo"), ocultamiento por diagnóstico
- [x] Notificaciones por correo (consulta publicada, etc.)
- [x] 6.1 Constraint GIST anti doble-booking (`appointments_no_overlap`) + 409 amable
- [x] 6.2 Producción por doctor (`/consola/produccion`)
- [x] 6.3 Series de citas recurrentes (`/api/series`, `/consola/series`)
- [x] 6.4 Consentimientos v2 (plantillas + firma en canvas)
- [x] 6.5 Planes de tratamiento (treatmentPlans/items/sesiones, `/consola/planes`)
- [x] 6.6 No-show con recuperación (enlace para re-agendar)
- [x] 6.8 Round-robin + feriados (tabla `holidays`, `teams.round_robin`,
      auto-asignación en reserva pública, `/consola/config/feriados`)
- [x] 6.7 Hospitalización 2.0: depósitos a cuenta (`admission_deposits` ligados
      a `payments`), liquidación (facturado − depositado = saldo) y handover
      de enfermería (`admission_handovers`) en el detalle de la admisión

**Salida OLA 5/6:** portal con cuenta real + operación madura (series, planes,
consentimientos firmados, caja de hospitalización).

---

## Reglas transversales

- En cada ola: **ship → vender → medir**. Sin venta, no se avanza.
- Toda tabla nueva lleva `tenant_id` + índice.
- Todo cambio de estado pasa por máquina de estado en `packages/core`.
- Todo lo de SUNAT y WhatsApp mantiene los dobles locales (lycet/Mailpit/whatsmock);
  credenciales reales solo en producción.
