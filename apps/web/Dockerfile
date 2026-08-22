# Imagen de producción de @clinicflow/web (Next.js 15 standalone).
# Se construye desde la RAÍZ del monorepo: docker-compose.prod.yml usa
#   context: .
#   dockerfile: apps/web/Dockerfile
# Con output: "standalone", el standalone queda en /app/apps/web/server.js.

FROM node:22-alpine AS deps
WORKDIR /app
# Manifests de todo el workspace para que `npm ci` enlace las dependencias locales.
COPY package.json package-lock.json tsconfig.base.json ./
COPY --parents apps/web/package.json packages/core/package.json packages/db/package.json packages/ui/package.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
# Fuente completo (el .dockerignore de la raíz excluye node_modules, .next, .git, .env*, etc.)
COPY . .
# El script build de la raíz compila primero db, core y ui (tsc -> dist) y luego web.
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3111
ENV HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodegroup && adduser -S -u 1001 -G nodegroup nextjs

# Estructura standalone de monorepo (contexto = raíz del repo):
#   /app/apps/web/server.js   <- servidor
#   /app/node_modules/...     <- pruned, trazado de node_modules
#   /app/package.json
COPY --from=build --chown=nodejs:nodegroup /app/apps/web/.next/standalone ./
COPY --from=build --chown=nodejs:nodegroup /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nodejs:nodegroup /app/apps/web/public ./apps/web/public

# Adjuntos: la app guarda los archivos en <cwd>/.data/attachments (apps/web/src/lib/attachments.ts),
# o en $ATTACHMENTS_DIR si está definido. El WORKDIR es /app/apps/web, por lo que la ruta por
# defecto es /app/apps/web/.data/attachments. docker-compose.prod.yml monta el volumen nombrado
# `attachments` en /app/apps/web/.data para persistirlos entre despliegues.
# Pre-creamos .data para que el volumen herede el owner nextjs en el primer arranque.
RUN mkdir -p /app/apps/web/.data/attachments && chown -R nextjs:nodegroup /app/apps/web/.data

USER nextjs
WORKDIR /app/apps/web
EXPOSE 3111
CMD ["node", "server.js"]
