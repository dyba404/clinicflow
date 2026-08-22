# instalar-cron.ps1 — [DEV-ONLY] SOLO desarrollo local en Windows.
# Registra las tareas programadas (Windows Task Scheduler) que llaman por HTTP a
# los endpoints /api/cron/* en localhost:3112 (mismos jobs que en producción).
# En PRODUCCIÓN NO SE USA: lo reemplaza el contenedor `cron` (supercronic,
# CRON_TZ=America/Lima) de docker-compose.prod.yml.
#
# OfCron (cada hora): POST cron/recordatorios, cron/renovaciones, cron/fiscal.
# OfCronDiario (todos los días a las 08:00): POST cron/diario, cron/recall,
# cron/seguimiento.
# Idempotente: si una tarea ya existe, la actualiza.
# Requiere ejecutarse como Administrador. Lee CRON_SECRET de .env.local
# (default dev-cron-secret).

$ErrorActionPreference = "Stop"

$repo = Split-Path $PSScriptRoot -Parent

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[instalar-cron] Ejecuta este script como Administrador." -ForegroundColor Red
    exit 1
}

$inner = @"
`$envFile = "$repo\.env.local"
`$secret = "dev-cron-secret"
if (Test-Path -LiteralPath `$envFile) {
    `$linea = Get-Content -LiteralPath `$envFile | Where-Object { `$_ -match "^CRON_SECRET=" } | Select-Object -First 1
    if (`$linea) {
        `$valor = (`$linea -replace "^CRON_SECRET=", "").Trim().Trim('"').Trim("'")
        if (`$valor) { `$secret = `$valor }
    }
}
`$h = @{ Authorization = "Bearer `$secret" }
Invoke-RestMethod -Method Post -Uri "http://localhost:3112/api/cron/recordatorios" -Headers `$h | Out-Null
Invoke-RestMethod -Method Post -Uri "http://localhost:3112/api/cron/renovaciones" -Headers `$h | Out-Null
Invoke-RestMethod -Method Post -Uri "http://localhost:3112/api/cron/fiscal" -Headers `$h | Out-Null
"@

$innerDiario = @"
`$envFile = "$repo\.env.local"
`$secret = "dev-cron-secret"
if (Test-Path -LiteralPath `$envFile) {
    `$linea = Get-Content -LiteralPath `$envFile | Where-Object { `$_ -match "^CRON_SECRET=" } | Select-Object -First 1
    if (`$linea) {
        `$valor = (`$linea -replace "^CRON_SECRET=", "").Trim().Trim('"').Trim("'")
        if (`$valor) { `$secret = `$valor }
    }
}
`$h = @{ Authorization = "Bearer `$secret" }
Invoke-RestMethod -Method Post -Uri "http://localhost:3112/api/cron/diario" -Headers `$h | Out-Null
Invoke-RestMethod -Method Post -Uri "http://localhost:3112/api/cron/recall" -Headers `$h | Out-Null
Invoke-RestMethod -Method Post -Uri "http://localhost:3112/api/cron/seguimiento" -Headers `$h | Out-Null
"@

function New-Body([string]$script) {
    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($script))
    return New-ScheduledTaskAction `
        -Execute "powershell.exe" `
        -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand $encoded"
}

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

$taskName = "OfCron"
$action = New-Body $inner
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Hours 1)
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Set-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings | Out-Null
    Write-Host "[instalar-cron] Tarea '$taskName' actualizada." -ForegroundColor Green
} else {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Cron horario de Clinicflow: recordatorios 24h, renovaciones de plan y reintentos fiscales" | Out-Null
    Write-Host "[instalar-cron] Tarea '$taskName' registrada (cada hora)." -ForegroundColor Green
}

$taskDiario = "OfCronDiario"
$actionDiario = New-Body $innerDiario
$triggerDiario = New-ScheduledTaskTrigger -Daily -At "08:00"
$existingDiario = Get-ScheduledTask -TaskName $taskDiario -ErrorAction SilentlyContinue
if ($existingDiario) {
    Set-ScheduledTask -TaskName $taskDiario -Action $actionDiario -Trigger $triggerDiario -Settings $settings | Out-Null
    Write-Host "[instalar-cron] Tarea '$taskDiario' actualizada." -ForegroundColor Green
} else {
    Register-ScheduledTask -TaskName $taskDiario -Action $actionDiario -Trigger $triggerDiario -Settings $settings -Description "Cron diario de Clinicflow (08:00): digest al dueño, recall automático y seguimiento de presupuestos" | Out-Null
    Write-Host "[instalar-cron] Tarea '$taskDiario' registrada (diaria 08:00)." -ForegroundColor Green
}

Write-Host "[instalar-cron] Verifica con: Get-ScheduledTask -TaskName OfCron; Get-ScheduledTask -TaskName OfCronDiario" -ForegroundColor Cyan
