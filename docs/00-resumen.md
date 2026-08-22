# clinicflow — Resumen ejecutivo

HIS (sistema de información hospitalaria) SaaS para clínicas privadas independientes
en Perú (20-100 camas, 10-50 médicos). Multi-tenant, venta institucional puerta a
puerta. Portado de odontoflow v1.6.2 (capa horizontal probada en producción dev:
tenancy, RBAC+audit, agenda/espera, caja, SUNAT real, portal passwordless, PWA offline,
compose prod fail-closed).

## Decisiones clave

| Tema | Decisión |
|---|---|
| Nicho MVP | Solo clínicas privadas con hospitalización corta (20-100 camas, 10-50 médicos). Sin ESSALUD/MINSA. Dental queda fuera (capa dental portada y renombrada por ola) |
| Quién compra | Venta institucional: director médico / administrador de clínica (no venta individual por médico) |
| Venta | Puerta a puerta, Lima primero. Motor de recomendación: médicos que trabajan en varios sitios + gremios de clínicas privadas |
| Planes | Standard S/2,500 · Pro S/4,500 · Premium S/7,500 al mes. Contrato anual. Gating de módulos por plan |
| Cobro de suscripciones (a nosotros) | MANUAL concierge: Yape/Plin/transferencia + contrato anual firmado. Culqi/autocobro solo cuando haya ~50 clientes |
| Roles | owner/gerente · recepcionista · doctor · asistente/enfermería (actuales) + laboratorista · farmacia · director médico (planificados por ola). Paciente = público sin cuenta |
| Historia clínica | Ley 29733: dato sensible. Toda lectura de ficha → `audit_logs` (visor "historia vista por" para el gerente, solo rol gerente/owner). Whitelist estricta: paciente nunca ve lista/agenda/ocupación |
| Facturación electrónica | Sidecar lycet (Greenter) como microservicio; cada tenant emite con SU RUC, SU certificado y SU Clave SOL. Verificado contra SUNAT beta real (boleta aceptada, baja por nota de crédito 07) |
| WhatsApp | Solo Cloud API oficial como add-on cobrado (OLA 4). Core: email |
| UI | Design system propio (teal clínico + neutros cálidos, español día 1, shadcn/ui + Tailwind). Instalable como PWA con modo offline (IndexedDB) |
| Hosting | Heroku con crédito Student Pack → VPS barato al tener MRR (compose prod portable fail-closed) |
| Stack | TypeScript/Node monorepo (npm workspaces), Next.js 15, Postgres 16, docker-compose fail-closed con cron supercronic |
| Referencias de diseño | `.references/` clonadas: medplum (Apache-2.0, FHIR), openemr (GPL-3.0, flujo lab/consulta), openmrs (Visita/Encuentro/Obs/Ubicación), lycet/greenter/whap (fiscal/WhatsApp) |
| Ruta local | `~/Documents/projects/clinicflow` |

## Modelo de ingreso (nosotros)
- Standard (S/2,500/mes): agenda + consulta externa + caja + facturación SUNAT
- Pro (S/4,500/mes): + hospitalización, laboratorio, imagen, farmacia interna
- Premium (S/7,500/mes): + quirófano, UCI, portal paciente completo, dashboard directivo
- Cobro manual concierge (contrato anual); conceptos de plan en tabla `subscriptions` (free→pro→premium vigentes; nombres de plan comerciales se remapean al vender)

## KPIs objetivo
- Conversión demo→pago ≥ 40% (demo cuenta institucional con datos de la clínica)
- Churn mensual < 5%
- 5-10 clínicas pagantes al final de las OLAs 2-3
- Tiempo de implementación por clínica < 2 semanas (migración de datos + capacitación)

## Estado
OLA 0 completa (2026-08-19): repo creado, 223 archivos renombrados byte-safe UTF-8
(0 mojibake), puertos dev separados del odontoflow vivo en el mismo host, `.references`
clonadas, docs reescritas (este documento), npm install limpio. Sistema heredado
maduro funcionando (ver `99-sesion-estado.md`). OLAs 1-4 por desarrollar:
`02-roadmap.md`.
