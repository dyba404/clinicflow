#!/bin/sh
# Entrypoint del contenedor cron: el bind mount /backups lo crea root en el
# host, así que (como root) se asegura la propiedad para el usuario sin
# privilegios supercronic y luego baja privilegios con su-exec.
set -eu
chown supercronic:supercronic /backups
exec su-exec supercronic "$@"
