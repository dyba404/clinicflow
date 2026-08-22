# Planificador de cron para clinicflow: supercronic (Aptible) sobre Alpine.
# Ejecuta el crontab con CRON_TZ=America/Lima: dispara los jobs /api/cron/*
# y el respaldo diario de la base de datos (backup-db.sh → /backups).

FROM alpine:3.20

# supercronic v0.2.49, binario linux-amd64.
# SHA256 oficial publicado en la API del release de GitHub:
# https://api.github.com/repos/aptible/supercronic/releases/tags/v0.2.49
ENV SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/v0.2.49/supercronic-linux-amd64 \
    SUPERCRONIC_SHA256=a53ae236602c7338aba3fbaff40bda6300eae3b9fedb8261eb06cfe3724430c1 \
    SUPERCRONIC=supercronic-linux-amd64

# La verificación de checksum hace fallar el build si el binario descargado no coincide.
# postgresql-client aporta pg_dump para el respaldo diario (backup-db.sh).
# su-exec permite arrancar como root (chown del bind mount /backups) y bajar
# privilegios antes de ejecutar el planificador.
RUN apk add --no-cache curl ca-certificates tzdata postgresql-client su-exec \
    && curl -fsSL -o "/tmp/${SUPERCRONIC}" "${SUPERCRONIC_URL}" \
    && echo "${SUPERCRONIC_SHA256}  /tmp/${SUPERCRONIC}" | sha256sum -c - \
    && chmod +x "/tmp/${SUPERCRONIC}" \
    && mv "/tmp/${SUPERCRONIC}" /usr/local/bin/supercronic

# En Alpine el grupo `cron` ya existe (paquete cronie); usamos un nombre propio.
RUN addgroup -S supercronic && adduser -S supercronic -G supercronic

# El destino de pg_dump vive en el volumen `backups` (./backups del host).
RUN mkdir -p /backups

WORKDIR /etc/supercronic
COPY crontab ./crontab
COPY backup-db.sh ./backup-db.sh
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./backup-db.sh ./entrypoint.sh

# Arranca como root solo para garantizar escritura en /backups (el bind mount
# lo crea root en el host) y enseguida baja a usuario sin privilegios.
ENTRYPOINT ["./entrypoint.sh"]
CMD ["supercronic", "crontab"]
