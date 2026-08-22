#!/bin/sh
# Respaldo diario de la base de datos Clinicflow (formato custom de pg_dump).
# Ejecutado por supercronic dentro del contenedor cron (ver crontab).
# El volumen /backups mapea a ./backups del host en docker-compose.prod.yml.
# Retención: 30 días (misma política que scripts/backup.ps1 de dev).
set -eu

DIR="/backups"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$DIR/clinicflow_backup_${STAMP}.dump"

PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "${DATABASE_HOST:-db}" \
  -p "${DATABASE_PORT:-5432}" \
  -U "${POSTGRES_USER:-clinicflow}" \
  -d "${POSTGRES_DB:-clinicflow}" \
  -Fc -f "$OUT"

echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') escrito $OUT ($(du -h "$OUT" | cut -f1))"

find "$DIR" -name 'clinicflow_backup_*.dump' -mtime +30 -delete
