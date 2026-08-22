param([int]$Port = 3112)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $repoRoot "apps\web"
$node = (Get-Command node).Source
$logDir = Join-Path $env:TEMP "opencode"
$outLog = Join-Path $logDir "next-out.log"
$errLog = Join-Path $logDir "next-err.log"

# El build es output: "standalone": "next start" no esta soportado con esa
# config (aviso en stderr). Se arranca el server standalone oficial, que
# necesita public/ y .next/static/ copiados junto a node_modules/.
# En monorepo el server queda en standalone/apps/web/server.js (igual que
# el Dockerfile de produccion, que corre con WORKDIR /app/apps/web).
$standaloneDir = Join-Path $webRoot ".next\standalone"
$standaloneWeb = Join-Path $standaloneDir "apps\web"
$serverJs = Join-Path $standaloneWeb "server.js"
if (-not (Test-Path -LiteralPath $serverJs)) {
  Write-Output "No hay build standalone: ejecutando npm run build..."
  Push-Location $webRoot
  npm run build
  Pop-Location
}

# Copias requeridas por el modo standalone (public y estaticos)
$pubDest = Join-Path $standaloneWeb "public"
$staticDest = Join-Path $standaloneWeb ".next\static"
if (Test-Path -LiteralPath $pubDest) { Remove-Item $pubDest -Recurse -Force }
if (Test-Path -LiteralPath $staticDest) { Remove-Item $staticDest -Recurse -Force }
Copy-Item -Path (Join-Path $webRoot "public") -Destination $pubDest -Recurse -Force
Copy-Item -Path (Join-Path $webRoot ".next\static") -Destination $staticDest -Recurse -Force

# Variables de entorno: el server standalone no carga .env.local por su
# cuenta, asi que se inyectan aqui (misma fuente que `next start`).
# clinicflow guarda el env en la RAIZ del repo (la misma que usan los
# scripts de drizzle); odontoflow lo tenia en apps/web. Se soportan ambos.
foreach ($envFile in @((Join-Path $repoRoot ".env.local"), (Join-Path $webRoot ".env.local"))) {
  if (Test-Path -LiteralPath $envFile) {
    foreach ($linea in Get-Content -LiteralPath $envFile) {
      if ($linea -match "^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$") {
        $clave = $Matches[1]
        $valor = ($Matches[2] -replace '^"', '' -replace '"$', "").Trim()
        Set-Item -Path "Env:$clave" -Value $valor
      }
    }
  }
}
# La app guarda adjuntos en <cwd>/.data/attachments; el cwd ahora es
# standalone/apps/web, asi que se apunta explicitamente al directorio real.
$env:ATTACHMENTS_DIR = Join-Path $webRoot ".data\attachments"
$env:PORT = "$Port"
$env:HOSTNAME = "0.0.0.0"

# Detener instancia previa sin matar otros procesos node (solo servers
# standalone de esta app, identificados por su server.js).
$procesos = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"
$matables = @($procesos | Where-Object {
  $cmd = $_.CommandLine
  if (-not $cmd) { return $false }
  if ($cmd -match "standalone.apps.web.server.js") { return $true }
  if ($cmd -match "^\S*node(\.exe)?\s+""?server\.js""?\s*$" -and $cmd -notmatch "odontoflow") { return $true }
  return $false
})
foreach ($p in $matables) {
  Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}
if ($matables.Count -gt 0) { Start-Sleep 1 }

$proc = Start-Process -FilePath $node -ArgumentList "`"$serverJs`"" `
  -WorkingDirectory $standaloneWeb -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $outLog -RedirectStandardError $errLog
Write-Output "Servidor iniciado en silencio (PID $($proc.Id)) -> http://localhost:$Port (logs: $outLog / $errLog)"
Write-Output "AVISO: con el server en marcha NO ejecutar 'npm run build': el server"
Write-Output "  retiene la carpeta .next y el build cuelga sin error (Windows)."
Write-Output "  Secuencia correcta: matar server -> build -> serve-console."
