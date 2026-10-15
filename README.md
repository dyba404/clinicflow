# Clinicflow

SaaS HIS (Hospital Information System) para clínicas privadas en Perú. Ficha clínica
multi-especialidad, agenda, sala de espera, caja y facturación electrónica SUNAT.
Multi-tenant con roles por staff. Crecimiento por olas: hospitalización, laboratorio,
imagen, quirófano y farmacia.

## Relación con odontoflow

Clinicflow es la generalización multi-especialidad de [odontoflow](https://github.com/dyba404/odontoflow),
un SaaS dental propio. Comparten arquitectura (monorepo npm workspaces,
Next.js 15 + Drizzle + packages core/db/ui, sidecar Greenter para SUNAT) pero el dominio
de clinicflow es propio: agenda round-robin con feriados, hospitalización con
depósitos/liquidación/handover, consentimientos v2, series y planes de tratamiento,
y portal de paciente con login.

## Documentación

Arquitectura (`docs/01`), modelo de datos (`docs/04`), roles y privacidad (`docs/03`),
estados y protocolos (`docs/06`) y roadmap (`docs/02`), todo en `docs/`.

## Estructura

```
apps/web                → Next.js 15 (superficies por rol + API, puerto dev 3112)
packages/ui             → design system (tokens teal)
packages/core           → dominio (roles, permisos, estados, engine de slots, tests)
packages/db             → schema Drizzle multi-tenant + migraciones + seed
scripts/                → utilidades Docker/DB/console
docker-compose.yml      → desarrollo local: Postgres 16 + sidecar lycet (Greenter) + Mailpit + whatsmock
docker-compose.prod.yml → producción: db + lycet + web (Next standalone) + cron (supercronic)
docker/cron/            → crontab + Dockerfile del contenedor cron (supercronic)
```

## Setup

```
docker compose up -d          # DEV: Postgres :5433 + lycet :8091 + Mailpit :1026/:8026 + whatsmock :3011
npm install
npm run db:migrate
npm run db:seed
npm run dev                   # http://localhost:3112
```

Copia `.env.local.example` a `.env.local` y ajusta según la tabla de variables de entorno.

**Puertos:** clinicflow convive en el mismo host con odontoflow
(`5432/8090/3111/1025/8025/3010`), así que usa puertos separados:

| Servicio | odontoflow | clinicflow |
|---|---|---|
| Postgres | 5432 | **5433** |
| App / consola | 3111 | **3112** |
| lycet (Greenter) | 8090 | **8091** |
| Mailpit (SMTP/Web) | 1025 / 8025 | **1026 / 8026** |
| whatsmock (WhatsApp) | 3010 | **3011** |

No cambiar estos puertos sin actualizar `docker-compose.yml` y `.env.local` a la vez.

## Despliegue (Docker Compose)

`docker-compose.prod.yml` levanta 4 contenedores: `db` (Postgres 16, sin puerto expuesto al
host), `lycet` (sidecar Greenter), `web` (Next.js standalone en :3111) y `cron`
(supercronic v0.2.49).

```
docker compose -f docker-compose.prod.yml up -d --build                  # levantar stack
docker compose -f docker-compose.prod.yml run --rm migrate npm run db:migrate  # migraciones
docker compose -f docker-compose.prod.yml run --rm migrate npm run db:seed     # seed demo
curl http://localhost:3111/api/health                                    # health check (200/503)
```

El contenedor `cron` corre solo desde el arranque: su crontab (`CRON_TZ=America/Lima`)
hace `POST` con `Bearer CRON_SECRET` a `http://web:3111/api/cron/*`. 6 jobs:

| Cron | Frecuencia | Qué hace |
|---|---|---|
| `recordatorios` | Cada hora | Recordatorio 24h antes de citas confirmadas + reintentos de fallidos. |
| `renovaciones` | Cada hora | Ciclo de suscripción: activo → por_renovar (≤3 días) → aviso el día de vencimiento → 7 días de gracia → suspendido. |
| `fiscal` | Cada hora | Reemisión de comprobantes `pendiente_envio` (≤7d) y `rechazados` (≤48h) vía lycet/SUNAT. |
| `diario` | Diario 08:00 (Lima) | Digest al owner: caja, stock bajo, laboratorio, pendientes. |
| `recall` | Diario | Recall automático de pacientes dormidos ≥6 meses (dedupe 60 días). |
| `seguimiento` | Diario | Seguimiento de presupuestos enviados hace ≥3 días (1er aviso) y ≥7 (final) + cuotas vencidas. |

En desarrollo local (Windows) los mismos endpoints se agendan con
`scripts/instalar-cron.ps1` (**dev-only**). Detalle en `docs/arquitectura.md`.

## Variables de entorno

| Variable | Requerida | Qué rompe si falta |
|---|---|---|
| `DATABASE_URL` | Sí | Arranque completo (conexión a Postgres). |
| `NEXT_PUBLIC_APP_URL` | Sí | Links en emails/citas apuntan a dominio incorrecto. |
| `RESEND_API_KEY` | Opcional | Envío de emails (recordatorios, confirmaciones, recalls, campañas) falla con `email_no_configurado`. |
| `RESEND_FROM` | Opcional | Remitente de emails; mismo fallo que sin `RESEND_API_KEY`. |
| `CRON_SECRET` | Opcional | Cron job (`/api/cron/*`) rechaza peticiones por autenticación. |
| `ADMIN_EMAILS` | Opcional | Acceso al panel `/admin`; vacío = nadie lo ve. |
| `LOCAL_MASTER_KEY` | Opcional | Cifrado at-rest de certificados/Clave SOL y tokens WhatsApp; sin ella la emisión electrónica no puede guardar credenciales. |
| `LYCET_URL` | Opcional | Emisión electrónica a SUNAT vía sidecar lycet (default `http://localhost:8091`); modo `manual` funciona sin él. |
| `WHATSAPP_VERIFY_TOKEN` | Opcional | Verificación del webhook de WhatsApp (Meta); el token y phone id se configuran desde consola y se cifran en DB. |
| `ATTACHMENTS_DIR` | Opcional | Directorio de adjuntos; default `.data/attachments`. |

## Credenciales demo

Seed crea 5 usuarios (password: `demo1234`, dominio `@demo.clinicflow.pe`):

| Email | Rol |
|---|---|
| `owner@demo.clinicflow.pe` | owner |
| `recepcion@demo.clinicflow.pe` | receptionist |
| `luis@demo.clinicflow.pe` | doctor |
| `maria@demo.clinicflow.pe` | doctor |
| `asistente@demo.clinicflow.pe` | assistant |

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Web en desarrollo (`next dev`). |
| `npm run build` | Build de todos los workspaces. |
| `npm run typecheck` | `tsc --noEmit` en todos los workspaces. |
| `npm run lint` | ESLint (apps/web) + lint por workspace. |
| `npm test` | Tests del core (`node --test` + tsx en packages/core). |
| `npm run db:generate` | Genera migraciones Drizzle desde el schema. |
| `npm run db:migrate` | Aplica migraciones. |
| `npm run db:seed` | Seed con datos demo. |
| `npm run of:up` / `of:down` / `of:status` / `of:db` | Docker Compose (WSL2): subir/bajar/estado/psql. |
| `instalar-cron` | **DEV-ONLY (Windows)**: tareas programadas `OfCron`/`OfCronDiario` → `localhost:3112/api/cron/*` (requiere `CRON_SECRET`). En despliegue lo reemplaza el contenedor `cron` (supercronic) de `docker-compose.prod.yml`. |
| `scripts/backup.ps1` | `pg_dump` vía WSL/docker → `backups/*.dump` (retención 30 días). |
| `GET /api/health` | Health check: `SELECT 1` con timeout 3s → 200 ok / 503. |

## Reglas

1. Multi-tenant: `tenant_id` en toda query y validación server-side.
2. La UI de BoxyHQ no se usa (solo su modelo headless de tenants/memberships).
3. Privacidad del paciente: whitelist estricta; el paciente nunca ve listas, agenda del doctor ni ocupación real.
4. Cobro de suscripciones es manual (Yape/Plin directo) vía panel admin; sin pasarela todavía.
5. Cada clínica emite comprobantes con SU RUC/certificado/Clave SOL (nunca el nuestro).
6. La historia clínica es dato sensible (Ley 29733): todo acceso a la ficha del paciente queda registrado en `audit_logs`.
