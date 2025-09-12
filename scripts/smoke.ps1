# scripts/smoke.ps1
param([switch]$StartDev)

Set-Location $PSScriptRoot\..
if ($StartDev) { Write-Host "Starting dev detached…" -ForegroundColor Cyan }
node --version | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error "Node.js not found in PATH"; exit 1 }

if (-not (Test-Path .\node_modules\@supabase\supabase-js)) {
  Write-Host "Installing @supabase/supabase-js…" -ForegroundColor Yellow
  npm i @supabase/supabase-js --silent | Out-Null
}

node scripts\smoke.mjs

