# setup-whatsmock.ps1 — levanta whatsmock, mock local de la WhatsApp Cloud API (whap).
# Uso:
#   .\scripts\setup-whatsmock.ps1    # idempotente: clona whap si falta, build + up del contenedor
#
# whatsmock es el "Mailpit de WhatsApp": un doble local de la API de Meta para ensayar
# el bot sin token ni numero reales (https://github.com/fdarian/whap, clonado en
# .references/whap, carpeta ignorada por git). Expone:
#   POST /v22.0/{phoneId}/messages  -> responde { messages: [{ id: "wamid..." }] } como Meta
#   GET  /health                    -> 200
#   POST /webhook/simulate-message  -> dispara un mensaje entrante contra el webhook local
# Ademas POSTea eventos de webhook simulados (delivery/read) a la app:
#   WEBHOOK_URL=http://<IP-vEthernet-WSL-de-Windows>:3111/api/whatsapp/webhook
# (dentro de WSL-Docker, host.docker.internal apunta al bridge 172.18.0.1 y NO
# alcanza a Windows; usar la IP de la interfaz vEthernet (WSL). Sobrescribible
# con la variable WHATSAPP_WEBHOOK_URL para docker compose).
#
# Para que la app envie contra el mock, en .env.local:
#   WHATSAPP_BASE_URL=http://127.0.0.1:3011/v22.0
# (default sin mock: https://graph.facebook.com/v19.0)

$ErrorActionPreference = "Continue"
$root = Split-Path $PSScriptRoot -Parent
$whapDir = Join-Path $root ".references\whap"
$composeDir = "/mnt/c/Users/Administrator/Documents/projects/clinicflow"

function Wsl([string]$inner) {
    wsl.exe -d Ubuntu -u dev -- bash -c $inner
}

if (-not (Test-Path -LiteralPath $whapDir)) {
    Write-Host "[whatsmock] Clonando whap en .references/whap..." -ForegroundColor Cyan
    git clone https://github.com/fdarian/whap $whapDir
    if (-not $?) {
        Write-Host "[whatsmock] Error clonando whap. Revisa conexion/git." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[whatsmock] .references/whap ya existe, omitiendo clone." -ForegroundColor DarkGray
}

Write-Host "[whatsmock] Asegurando daemon Docker en WSL..." -ForegroundColor Cyan
Wsl "sudo service docker status >/dev/null 2>&1 || sudo service docker start" *> $null

Write-Host "[whatsmock] Construyendo y levantando contenedor whatsmock (puede tardar la primera vez)..." -ForegroundColor Cyan
# Borra cualquier container huerfano con el mismo nombre antes del up --build.
Wsl "sudo docker rm -f clinicflow-whatsmock >/dev/null 2>&1; cd $composeDir && sudo docker compose up -d --build whatsmock" 2>&1 | Select-Object -Last 5

Write-Host "[whatsmock] Esperando health en http://localhost:3011/health ..." -ForegroundColor Cyan
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
    $r = curl.exe -s -m 2 http://localhost:3011/health 2>$null
    if ($LASTEXITCODE -eq 0 -and $r) { $ok = $true; break }
    Start-Sleep 2
}

if ($ok) {
    Write-Host "[whatsmock] Listo. Mock activo en http://localhost:3011" -ForegroundColor Green
    Write-Host "[whatsmock] En .env.local usa: WHATSAPP_BASE_URL=http://127.0.0.1:3011/v22.0" -ForegroundColor Green
} else {
    Write-Host "[whatsmock] El health no respondio. Revisa logs:" -ForegroundColor Red
    Write-Host "  wsl.exe -d Ubuntu -u dev -- bash -c 'sudo docker logs clinicflow-whatsmock'" -ForegroundColor Yellow
    exit 1
}
