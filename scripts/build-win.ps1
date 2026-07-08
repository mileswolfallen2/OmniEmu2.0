# Build OmniEmu for Windows
# Usage: .\scripts\build-win.ps1 [-Arch <x64|arm64>]
# Requires: Node.js, npm

param(
    [ValidateSet("x64", "arm64")]
    [string]$Arch = "x64"
)

$ErrorActionPreference = "Stop"
Push-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "==> Installing dependencies..." -ForegroundColor Cyan
npm install

Write-Host "==> Building for Windows ($Arch)..." -ForegroundColor Cyan
npm run build

Write-Host "==> Packaging for Windows ($Arch)..." -ForegroundColor Cyan
if ($Arch -eq "arm64") {
    npx electron-builder --win --arm64
} else {
    npx electron-builder --win --x64
}

Write-Host "==> Done! Artifacts in ./release/" -ForegroundColor Green
Pop-Location
