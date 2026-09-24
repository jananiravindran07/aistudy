# Initializes a fresh local PostgreSQL cluster, creates the app role/database,
# and applies the Prisma migrations. Only needed on a new machine — see
# README for the Docker alternative.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\db-init.ps1

param(
  [string]$PgBin   = "$env:LOCALAPPDATA\Programs\postgres\pgsql\bin",
  [string]$DataDir = "$env:LOCALAPPDATA\Programs\postgres\data",
  [int]$Port       = 5432,
  [string]$DbUser  = 'aistudy',
  [string]$DbPass  = 'aistudy',
  [string]$DbName  = 'aistudy'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path (Join-Path $PgBin 'initdb.exe'))) {
  throw "initdb.exe not found in '$PgBin'. Set -PgBin to <postgres>\pgsql\bin."
}

# 1. initdb (skips if a cluster already exists)
if (-not (Test-Path (Join-Path $DataDir 'PG_VERSION'))) {
  Write-Host 'Initializing a new database cluster…' -ForegroundColor Cyan
  & (Join-Path $PgBin 'initdb.exe') -D $DataDir -U postgres -A trust -E UTF8 --no-locale
  if ($LASTEXITCODE -ne 0) { throw 'initdb failed.' }
} else {
  Write-Host "Cluster already exists at $DataDir — skipping initdb." -ForegroundColor Yellow
}

# 2. Start the server (WMI-spawned so it survives this shell)
& (Join-Path $PSScriptRoot 'db-start.ps1') -PgBin $PgBin -DataDir $DataDir -Port $Port

# 3. Create role + database idempotently
$psql  = Join-Path $PgBin 'psql.exe'
$envVars = "PGPORT=$Port"

& $psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DbUser') THEN CREATE ROLE $DbUser LOGIN PASSWORD '$DbPass'; END IF; END \$\$;"
if ($LASTEXITCODE -ne 0) { throw 'Failed to create database role.' }

& $psql -h localhost -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DbName'" | Out-Null
$exists = (& $psql -h localhost -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DbName'").Trim()
if ($exists -ne '1') {
  & $psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DbName OWNER $DbUser;"
  if ($LASTEXITCODE -ne 0) { throw 'Failed to create database.' }
} else {
  Write-Host "Database $DbName already exists." -ForegroundColor Yellow
}

# 4. Apply the Prisma schema/migrations
Write-Host 'Applying Prisma migrations…' -ForegroundColor Cyan
Push-Location (Join-Path $PSScriptRoot '..')
try {
  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw 'prisma migrate deploy failed.' }
} finally {
  Pop-Location
}

Write-Host "Done. DATABASE_URL should be: postgresql://$DbUser`:$DbPass@localhost:$Port/$DbName?schema=public" -ForegroundColor Green