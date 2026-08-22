$ErrorActionPreference = "Stop"

Write-Host "Iniciando respaldo de base de datos Clinicflow..."

$wslCmd = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wslCmd) {
    Write-Host "ERROR: wsl.exe no esta disponible en este equipo." -ForegroundColor Red
    exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$backupsDir = Join-Path $repoRoot "backups"
if (-not (Test-Path -LiteralPath $backupsDir)) {
    Write-Host "Creando carpeta de respaldos: $backupsDir"
    New-Item -ItemType Directory -Path $backupsDir | Out-Null
}

Write-Host "Ejecutando pg_dump dentro del contenedor clinicflow-db..."
& wsl.exe -d Ubuntu -u dev -- docker exec clinicflow-db pg_dump -U clinicflow -d clinicflow -Fc -f /tmp/clinicflow_backup.dump
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: pg_dump fallo con codigo $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

$marca = Get-Date -Format "yyyyMMdd_HHmmss"
$archivoLocal = Join-Path $backupsDir ("clinicflow_backup_" + $marca + ".dump")

Write-Host "Copiando respaldo fuera del contenedor..."
# `docker cp contenedor:ruta -` emite un stream TAR por stdout (no el archivo
# crudo), asi que se copia primero a WSL y de ahi al disco de Windows.
& wsl.exe -d Ubuntu -u dev -- docker cp clinicflow-db:/tmp/clinicflow_backup.dump /tmp/clinicflow_backup.dump
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: la copia del respaldo a WSL fallo con codigo $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
$wslDest = "/mnt/" + $archivoLocal.Substring(0, 1).ToLower() + ($archivoLocal.Substring(2) -replace "\\", "/")
& wsl.exe -d Ubuntu -u dev -- cp /tmp/clinicflow_backup.dump $wslDest
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: la copia del respaldo a Windows fallo con codigo $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
& wsl.exe -d Ubuntu -u dev -- rm -f /tmp/clinicflow_backup.dump

if (-not (Test-Path -LiteralPath $archivoLocal)) {
    Write-Host "ERROR: no se genero el archivo local del respaldo." -ForegroundColor Red
    exit 1
}

Write-Host "Limpiando archivo temporal dentro del contenedor..."
& wsl.exe -d Ubuntu -u dev -- docker exec clinicflow-db rm -f /tmp/clinicflow_backup.dump

Write-Host "Eliminando respaldos locales con mas de 30 dias..."
$antiguos = Get-ChildItem -Path $backupsDir -Filter "clinicflow_backup_*.dump" -File |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) }
foreach ($viejo in $antiguos) {
    Remove-Item -LiteralPath $viejo.FullName -Force
    Write-Host ("Eliminado: " + $viejo.Name)
}

Write-Host "Respaldo completado: $archivoLocal" -ForegroundColor Green
exit 0
