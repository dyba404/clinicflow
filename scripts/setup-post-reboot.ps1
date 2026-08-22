$ErrorActionPreference = "Stop"
$git = "C:\Program Files\Git\cmd\git.exe"
$proj = "C:\Users\Administrator\Documents\projects\clinicflow"

function Step($m) { Write-Host "`n== $m ==" -ForegroundColor Cyan }

Step "1/6 Verificando WSL"
wsl.exe --status

Step "2/6 Instalando Ubuntu (si no existe)"
$distros = wsl.exe -l -q
if ($distros -notmatch "Ubuntu") {
    wsl.exe --install -d Ubuntu --no-launch
    Start-Sleep 5
    wsl.exe -d Ubuntu -u root -- bash -c "useradd -m -s /bin/bash dev && echo 'dev:clinicflow-dev' | chpasswd && usermod -aG sudo dev 2>/dev/null || true; printf '[boot]\nsystemd=true\n' > /etc/wsl.conf"
    wsl.exe -d Ubuntu -u root -- bash -c "printf 'dev ALL=(ALL) NOPASSWD:ALL\n' > /etc/sudoers.d/dev && chmod 440 /etc/sudoers.d/dev"
} else {
    Write-Host "Ubuntu ya existe, saltando"
}
wsl.exe --shutdown
Start-Sleep 3

Step "3/6 Instalando Docker en Ubuntu"
wsl.exe -d Ubuntu -u dev -- bash -lc "
set -e
if command -v docker &>/dev/null; then
    echo 'docker ya instalado'; exit 0
fi
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(lsb_release -cs) stable\" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker \$(whoami)
sudo service docker start
"

Step "4/6 Verificando docker"
wsl.exe -d Ubuntu -u dev -- bash -lc "docker run --rm hello-world && docker compose version"

Step "5/6 Referencias (.references)"
Set-Location $proj
if (-not (Test-Path ".references")) { New-Item -ItemType Directory ".references" | Out-Null }
$repos = @(
    @{ n="saas-starter-kit"; u="https://github.com/boxyhq/saas-starter-kit.git" },
    @{ n="lycet"; u="https://github.com/giansalex/lycet.git" },
    @{ n="greenter"; u="https://github.com/thegreenter/greenter.git" },
    @{ n="open-salon"; u="https://github.com/clawnify/open-salon.git" },
    @{ n="shadcn-admin"; u="https://github.com/satnaing/shadcn-admin.git" }
)
foreach ($r in $repos) {
    $p = ".references\$($r.n)"
    if (Test-Path $p) { Write-Host "$($r.n) ya clonado"; continue }
    & $git clone --depth 1 $r.u $p
}

Step "6/6 Estado final"
wsl.exe -d Ubuntu -u dev -- docker compose version
Write-Host "`nListo. Postgres/docker OK. Abre opencode y escribe 'continua'." -ForegroundColor Green
