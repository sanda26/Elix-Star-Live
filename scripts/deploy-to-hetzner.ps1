# Deploy Anber Live to a Hetzner server via SSH.
# Usage:
#   .\scripts\deploy-to-hetzner.ps1
#   $env:HETZNER_HOST = "root@123.45.67.89"; .\scripts\deploy-to-hetzner.ps1
#
# Set HETZNER_HOST to user@host (e.g. deploy@anberlive.co.uk or root@123.45.67.89).
# Optional: HETZNER_REPO_PATH = path on server (default: ~/anber-live or project name).

$ErrorActionPreference = "Stop"
$hostName = $env:HETZNER_HOST
$repoPath = $env:HETZNER_REPO_PATH
if (-not $repoPath) {
    $repoPath = "~/anber-live"
}

if (-not $hostName) {
    Write-Host "HETZNER_HOST is not set. Set it to your Hetzner server (user@host)." -ForegroundColor Yellow
    Write-Host "Example: `$env:HETZNER_HOST = 'deploy@123.45.67.89'" -ForegroundColor Gray
    Write-Host "Or:      `$env:HETZNER_HOST = 'deploy@anberlive.co.uk'" -ForegroundColor Gray
    $hostName = Read-Host "Enter HETZNER_HOST (user@host)"
}

Write-Host "Deploying to $hostName (path: $repoPath)..." -ForegroundColor Cyan

$remoteCmd = @"
set -e
cd $repoPath || { echo 'Directory not found. Clone the repo first (see docs/DEPLOYMENT_GUIDE.md).'; exit 1; }
git pull
docker compose build --no-cache
docker compose up -d
docker compose ps
echo 'Done. Check https://your-domain/health'
"@

# Run over SSH (single line for PowerShell)
$remoteCmdOneLine = $remoteCmd -replace "`r`n", " ; " -replace "`n", " ; "
& ssh -o ConnectTimeout=10 $hostName $remoteCmdOneLine

if ($LASTEXITCODE -ne 0) {
    Write-Host "Deploy failed (exit code $LASTEXITCODE)." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Deploy finished." -ForegroundColor Green
