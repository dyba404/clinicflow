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
- [ ] npm install / typecheck / lint verificado (pendiente de sesión de arranque)

**Salida:** workspace clinicflow corre sin tocar odontoflow; listo para OLA 1.

---

## [ ] OLA 1 — Núcleo de consulta externa (3 agentes en paralelo)

Objetivo: una clínica que solo hace consulta externa puede operar todo su día.
Puerta de venta: la clínica ve agenda + historia CIE-10 + laboratorio/imagen ordenados
y cobra/factura igual que hoy.

### Agente 1.1 — Paciente / ficha multi-especialidad + historias clínicas
- [ ] Port del módulo pacientes/ficha de odontoflow adaptado a clínica médica
- [ ] Quitar odontograma (FDI) y campos dentales de la ficha
- [ ] Ficha por persona: datos, antecedentes, alergias, medicación, gestación pasan a modelo médico
- [ ] Historias clínicas por especialidad: soporte para múltiples especialidades por paciente
- [ ] Registro "historia vista por" (auditoría Ley 29733) sobre cada lectura de ficha

### Agente 1.2 — Catálogo CIE-10 y diagnósticos
- [ ] Nueva tabla `diagnoses` (diagnósticos aplicados a consulta) + catálogo CIE-10
- [ ] Carga del catálogo CIE-10 desde fuente MINSA (script + seed)
- [ ] Selector de diagnóstico en consulta con búsqueda por código/descripción

### Agente 1.3 — Agenda multi-especialidad + espera con triaje + consulta
- [ ] Agenda con recursos = doctor + consultorio (no solo doctor)
- [ ] Sala de espera con paso de triaje antes de consulta
- [ ] Consulta con nota SOAP (subjetivo/objetivo/análisis/plan)
- [ ] Diagnóstico CIE-10 por consulta (ligado a la tabla diagnoses)
- [ ] Orden de laboratorio / imagen desde la consulta (prepara OLA 2)
- [ ] Obligaciones y consentimientos canvas→PDF (portado de odontoflow, adaptados a médico)
- [ ] Cotización de tratamiento: presupuesto/cuota se mantiene como cotización (quotes/installments)

**Salida OLA 1:** demo vendible "solo consulta externa". Vendible y medible.

---

## [ ] OLA 2 — Diagnóstico + hospitalización (3 agentes en paralelo)

Objetivo: clínicas con internamiento corto (20-100 camas) y sus servicios de apoyo.

### Agente 2.1 — Hospitalización
- [ ] Admisión del paciente (estado + motivo + servicio)
- [ ] Pivote de camas: asignar/liberar/transferir cama
- [ ] Evolución diaria (nota de evolución por día de internamiento)
- [ ] Epicrisis al egreso (documento de alta)
- [ ] Transferencia de cama y alta (voluntaria / médica)

### Agente 2.2 — Enfermería por turno
- [ ] Turnos de enfermería (mañana/tarde/noche)
- [ ] Signos vitales como observaciones (presión, temperatura, FC, FR, SpO2)
- [ ] Registro por turno con responsable + audit

### Agente 2.3 — Laboratorio clínico + imagen + farmacia interna
- [ ] Laboratorio clínico: orden→toma→procesar→validar→liberar→entregar
      (flujo de referencia: openemr, lectura con validación clínica)
- [ ] Resultados por parámetro con rango de referencia (text/numérico + unidad)
- [ ] PDF de resultados para el paciente y el médico
- [ ] Reemplaza `lab_orders` de odontoflow (que es prótesis dental) por órdenes clínicas
- [ ] Imagen: orden→informe→adjunto PDF (visor DICOM OHIF queda en backlog)
- [ ] Farmacia interna: dispensación ligada a orden médica
- [ ] Kardex y lotes con FEFO (reutiliza `inventory_items` / `stock_movements` de odontoflow renombrados a "fármacos / movimientos")

**Salida OLA 2:** hospitalización corta operativa + laboratorio/imagen/farmacia en línea.
Vendible como clínica integral.

---

## [ ] OLA 3 — Cirugía + institucional (2 agentes)

### Agente 3.1 — Sala de operaciones (quirófano)
- [ ] Programación de cirugía (fecha, sala, equipo, procedimiento)
- [ ] Checklist pre-operatorio
- [ ] Clasificación anestésica ASA + registro de anestesia
- [ ] Registro intraoperatorio (inicio/fin, equipo, complicaciones)
- [ ] URPA (recuperación post-anestésica)
- [ ] Regreso a piso o egreso post-URPA

### Agente 3.2 — UCI simplificada + facturación institucional
- [ ] UCI simplificada: monitoreo + hoja de balance hídrico
- [ ] Refuerzo de facturación institucional:
      box/comprobante por paciente + convenio con aseguradoras (EPS/seguro)
      (se apoya en `insurers`/`patient_coverages` heredados, renombrados a convenios)

**Salida OLA 3:** clínicas con quirófano y UCI. Planes Premium completos.

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

## Reglas transversales

- En cada ola: **ship → vender → medir**. Sin venta, no se avanza.
- Toda tabla nueva lleva `tenant_id` + índice.
- Todo cambio de estado pasa por máquina de estado en `packages/core`.
- Todo lo de SUNAT y WhatsApp mantiene los dobles locales (lycet/Mailpit/whatsmock);
  credenciales reales solo en producción.
