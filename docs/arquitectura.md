# Topología del sistema

## Mapa de superficies

```
Dominio propio (ej. clinicflow.pe / .app — se decide al registrar)
│
├── www.<dominio>          → Landing de marketing dirigida a administradores de clínica (estática)
├── app.<dominio>          → Consola (gerente / recepción / doctor / enfermería) + API
├── r.<dominio>/<clinica>  → Página pública de reservas de cada clínica (una URL por clínica)
└── api.<dominio>          → Mismo despliegue de app (monolito Next.js + routes handlers)
         │
    ┌────┴──────────────┬───────────────┬────────────────┬───────────────────┐
    Postgres 16         Contenedor cron Notificaciones    Pagos suscripción   Facturación electrónica
    (composición        jobs → /api/    email             MANUAL (Yape/Plin)  sidecar lycet (Greenter)
     Docker)            cron/* + backup (Resend)          contrato anual      Docker, API REST
                        pg_dump 03:40 Lima
```

Dentro de `app.<dominio>`: `/admin` = panel de soporte de la plataforma (solo fundador
`is_platform_admin`, sesión plataforma sin membership) con reenvío de recuperación,
bloqueos e impersonación; todo auditado en el tenant afectado. + `primer-acceso` =
cambio de contraseña obligatorio del primer login.

## Decisiones

- **GitHub Pages: DESCARTADO** para superficies públicas. GitHub queda SOLO como
  repositorio privado del código. **Nota actual: el repo es local, sin remote todavía**
  (git local; el remote se decide al armar CI/CD remoto, pendiente de pre-producción).
- **Monolito Next.js** (apps/web): páginas + API routes. Nada de microservicios hasta que duelan.
- **Sidecar Greenter**: `giansalex/lycet` (MIT, Symfony+Docker) como segundo proceso;
  Node lo llama vía `POST /documents` con el token del sidecar. Modo `manual` funciona sin él.
  Cada clínica emite con SU RUC / SU certificado / SU Clave SOL, nunca el nuestro.
- **WhatsApp Cloud API (add-on, OLA 4)**: integración oficial, webhook entrante,
  plantillas de utilidad cobradas con margen. Contra SUNAT beta y dobles locales
  (whatsmock) en dev.

## Infra local de desarrollo (misma máquina que odontoflow)

```
Windows 11 24H2
├── node / npm / git / código  → C:\Users\Administrator\Documents\projects\clinicflow
└── WSL2: Ubuntu 26.04 LTS (usuario: dev), systemd habilitado, Docker 29.x
    ├── postgres:16 (container clinicflow-db)      ↑ localhost:5433
    ├── lycet (container clinicflow-lycet)         ↑ localhost:8091
    ├── mailpit (container clinicflow-mailpit)     ↑ SMTP :1026 / UI :8026
    ├── whatsmock (container clinicflow-whatsmock) ↑ :3011 (API Meta-compatible)
    └── app sidecar dev                            ↑ localhost:3112
```

**Separación de puertos con odontoflow (corriendo en la misma máquina):**

| Servicio | clinicflow (este) | odontoflow (retiene) |
|---|---|---|
| Postgres | 5433 | 5432 |
| App/sidecar dev | 3112 | 3111 |
| lycet | 8091 | 8090 |
| Mailpit SMTP / UI | 1026 / 8026 | 1025 / 8025 |
| whatsmock | 3011 | 3010 |

- Código en Windows; los contenedores solo corren servicios (nada montado desde Windows salvo el compose vía `/mnt/c`).
- Contenedores renombrados: `clinicflow-db`, `clinicflow-lycet`, `clinicflow-mailpit`, `clinicflow-whatsmock`.
- Desde Windows: `postgres://clinicflow:clinicflow_dev@localhost:5433/clinicflow` (ver `.env.local.example`).

**VM WSL compartida con odontoflow (keep-alive):**

La VM WSL (Ubuntu) es la MISMA para ambos proyectos. wslservice la apaga por
inactividad cuando muere la última sesión (vmIdleTimeout=-1 de .wslconfig no
se honra sin `wsl --shutdown` previo), lo que mata dockerd y los contenedores
de AMBOS proyectos. La mantiene viva la tarea programada
`OdontoFlow-WSL-Boot` del proyecto odontoflow: sesión eterna oculta vía VBS
(`sleep infinity` sin ventana) + triggers logon/1-min como red de seguridad
(fix de la sesión 28 de odontoflow, bug #4, commit `6039550`; verificado
41 OK/0 fallos y relanzamiento automático en 25s tras kill manual).

- Reproducible tras formatear la máquina: un solo comando restaura todo →
  `odontoflow\scripts\configurar-keepalive-wsl.ps1` (usa
  `odontoflow\scripts\keepalive-sesion.vbs`).
- `scripts/of.ps1 up` aporta además un keep-alive secundario propio
  (`wsl tail -f /dev/null`) mientras Postgres esté arriba.

## Producción (docker-compose.prod.yml fail-closed, portado)

```
Host (VPS / máquina de despliegue)
├── db      postgres:16 — sin puerto expuesto al host (solo red interna)
├── lycet   sidecar Greenter (facturación SUNAT), red interna
├── web     Next.js standalone —/apps/web Dockerfile— puerto interno :3111
│            DATABASE_URL → db:5432 · LYCET_URL → http://lycet:8000/api/v1
├── migrate servicio one-shot (profile tools): npm run db:migrate / db:seed
├── cron    supercronic — crontab con CRON_TZ=America/Lima; POST /api/cron/<job>
│            con Bearer $CRON_SECRET + backup diario 03:40 Lima
└── proxy   reverse proxy (Caddy o túnel) — publica :443 hacia web:3111
```

- **Fail-closed**: las variables obligatorias (`POSTGRES_PASSWORD`, `CRON_SECRET`,
  `LOCAL_MASTER_KEY`, `LYCET_TOKEN`, `NEXT_PUBLIC_APP_URL`) usan `${VAR:?mensaje}`;
  el `compose up` falla si faltan. Los `/api/cron/*` rechazan todo (401) sin
  `CRON_SECRET` configurado. `.env.prod.example` con generadores y advertencias.
- **Migraciones one-shot**: la imagen standalone de web no incluye drizzle-kit (devDep
  podada), por eso el servicio `migrate` de un solo uso con el workspace completo:
  `docker compose -f docker-compose.prod.yml run --rm migrate npm run db:migrate`.
- **Backup diario**: contenedor cron con `postgresql-client` + `backup-db.sh`
  (pg_dump -Fc a las 03:40 America/Lima → `./backups` del host, retención 30 días).
- **Health check**: `GET /api/health` → SELECT 1 (timeout 3s) → 200/503.

## Jobs del contenedor cron (heredados de odontoflow)

| Job | Frecuencia | Flujo (1 línea) |
|---|---|---|
| `recordatorios` | Cada hora | Recordatorio 24h a citas confirmadas de mañana (email, WhatsApp add-on, fallback email) + reintento de fallidos |
| `renovaciones` | Cada hora | Suscripción vence en ≤3 días → `por_renovar` → aviso → +7 días de gracia → `suspendido` |
| `fiscal` | Cada hora | Reintenta vía lycet comprobantes `pendiente_envio` (≤7d) y `rechazados` (≤48h) → `aceptado` o quedan `rechazado` |
| `diario` | Diario 08:00 Lima | Digest al gerente: caja, stock bajo, órdenes de laboratorio, pendientes |
| `recall` | Diario | Pacientes dormidos ≥6 meses por tenant con recall automático activo (dedupe 60 días) |
| `seguimiento` | Diario | Avisos a cotizaciones de tratamiento `enviado` ≥3 y ≥7 días; marca `vencida` las cuotas cuyo vencimiento pasó |
| backup | Diario 03:40 Lima | pg_dump -Fc → `./backups`, retención 30 días (se agrega en producción) |

## Multi-tenancy y monorepo

- Single-database con `tenant_id` (= teams.id) en TODA query; schema-per-tenant descartado.
- Middleware server-side: valida sesión + membresía + rol (+ restricción opcional fuera de turno).

```
~/Documents/projects/clinicflow/
├── docs/            ← estos documentos
├── apps/
│   └── web/         → Next.js (superficies por ruta + API + PWA)
├── packages/
│   ├── ui/          → design system (tokens teal, shadcn/ui)
│   ├── core/        → dominio: roles, permisos, estados, slots, caja
│   └── db/          → schema + migraciones
```

## Checklist pre-producción (EXTERNO, pendiente)

- [ ] VPS + dominio + HTTPS (el compose es portable: cualquier host con Docker)
- [ ] `.env` prod real: `POSTGRES_PASSWORD`, `CRON_SECRET`, `LOCAL_MASTER_KEY`, `LYCET_TOKEN`, `NEXT_PUBLIC_APP_URL`
- [ ] Resend con dominio verificado (DKIM/SPF)
- [ ] Meta WhatsApp Business (solo para add-on, OLA 4)
- [ ] CI/CD remoto (repo local → remote + pipeline)
- [ ] Backup restaurado probado en host destino (OLA 4)

## Seguridad heredada (odontoflow)

- Headers de seguridad en `/api/*` (middleware edge-safe), rate limits in-memory
  con `Retry-After` (429) en rutas públicas/auth.
- Cifrado at-rest de certificado SUNAT y Clave SOL con `LOCAL_MASTER_KEY` (lib/crypto).
- PWA: `manifest.webmanifest` + `sw.js` (navigations network-first con fallback
  `offline.html`), banner offline e IndexedDB para borradores.
