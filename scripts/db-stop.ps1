# Stops the local portable PostgreSQL used by AI Study Assistant.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\db-stop.ps1

param(
  [string]$PgBin   = "$env:LOCALAPPDATA\Programs\postgres\pgsql\bin",
  [string]$DataDir = "$env:LOCALAPPDATA\Programs\postgres\data",
  [int]$Port       = 5432
)

$ErrorActionPreference = 'Stop'

$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $conn) {
  Write-Host "Nothing is listening on port $Port — nothing to stop." -ForegroundColor Yellow
  exit 0
}

# Prefer a graceful pg_ctl stop (works even for WMI-spawned postgres).
$pgctl = Join-Path $PgBin 'pg_ctl.exe'
if (Test-Path $pgctl) {
  & $pgctl -D $DataDir stop -m fast
} else {
  Stop-Process -Id $conn.OwningProcess -Force
}

Start-Sleep -Seconds 1

if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  # Graceful stop failed — force-kill whatever is holding the port.
  $stuck = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($stuck) { Stop-Process -Id $stuck.OwningProcess -Force }
  Write-Warning 'Graceful stop did not release the port; force-killed the remaining process.'
} else {
  Write-Host 'PostgreSQL stopped.' -ForegroundColor Green
}