# Scripts

## setup-post-reboot.ps1
Ejecutar DESPUES del reinicio, en PowerShell con admin (o doble clic).
Idempotente: puede re-ejecutarse si algo falla a la mitad.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-post-reboot.ps1
```

### Que hace
1. Verifica WSL (`wsl --status`)
2. Instala Ubuntu si no existe (usuario `dev`, sin pedir interaccion)
3. Habilita systemd + sudo NOPASSWD en Ubuntu
4. Instala Docker Engine + compose plugin (repo oficial Docker)
5. Corre `docker run --rm hello-world` para verificar


## backup.ps1
Genera un respaldo de la base de datos Postgres (contenedor `clinicflow-db` en WSL/Ubuntu).

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup.ps1
```

### Que hace
1. Verifica que `wsl.exe` este disponible.
2. Ejecuta `pg_dump` dentro del contenedor `clinicflow-db` (formato comprimido `-Fc`).
3. Copia el respaldo a `backups\clinicflow_backup_yyyyMMdd_HHmmss.dump` (crea la carpeta si no existe).
4. Elimina el temporal dentro del contenedor.
5. Borra respaldos locales con mas de 30 dias de antiguedad.

Requisitos: WSL con distro Ubuntu, Docker activo y contenedor `clinicflow-db` en ejecucion.

## Endpoint de salud
`GET /api/health` no requiere autenticacion. Ejecuta `SELECT 1` contra la base de datos con
timeout de 3 segundos.

- Respuesta `200`: `{ "ok": true, "db": true, "version": "1.0.0", "ts": "..." }`
- Respuesta `503`: `{ "ok": false, "db": false, "version": "1.0.0", "ts": "..." }` si la base no responde.

Util para monitoreo externo y verificacion despues de desplegar.

