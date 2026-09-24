# Starts the local portable PostgreSQL used by AI Study Assistant.
#
# On machines where Docker or Windows services are unavailable (e.g. no admin
# rights), PostgreSQL is launched as a DETACHED process via WMI so it survives
# this shell exiting. Requires an initialized data directory (see db-init.ps1).
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\db-start.ps1

param(
  [string]$PgBin   = "$env:LOCALAPPDATA\Programs\postgres\pgsql\bin",
  [string]$DataDir = "$env:LOCALAPPDATA\Programs\postgres\data",
  [int]$Port       = 5432
)

$ErrorActionPreference = 'Stop'
$postgres = Join-Path $PgBin 'postgres.exe'

if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "PostgreSQL is already listening on port $Port." -ForegroundColor Green
  exit 0
}

if (-not (Test-Path $postgres)) {
  throw "postgres.exe not found at '$postgres'. Adjust -PgBin (point it at <postgres>\pgsql\bin)."
}
if (-not (Test-Path (Join-Path $DataDir 'PG_VERSION'))) {
  throw "No database cluster found at '$DataDir'. Run scripts\db-init.ps1 first (or set -DataDir)."
}

# Spawn detached via WMI so the process is NOT killed when this shell finishes.
$cmd = '"' + $postgres + '" -D "' + $DataDir + '" -p ' + $Port
$result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd }
if ($result.ReturnValue -ne 0) {
  throw "Win32_Process.Create failed with code $($result.ReturnValue): could not start postgres."
}

# Wait for the port to accept connections.
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 500
  if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "PostgreSQL started on port $Port (pid $($result.ProcessId))." -ForegroundColor Green
    exit 0
  }
}

throw 'PostgreSQL did not start within 20s. Check the data directory, port, and the log at <DataDir>\log\*.log.'