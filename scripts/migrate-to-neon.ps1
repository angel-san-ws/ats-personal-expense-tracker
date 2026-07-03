# Copies the local Docker Postgres database (schema + data) into a Neon database.
#
# Usage:
#   .\scripts\migrate-to-neon.ps1 -NeonUrl "postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/DBNAME?sslmode=require"
#
# Requirements: the ats_expense_db container must be running (docker compose up -d).
# The dump/restore runs entirely inside the container so no local Postgres tools
# are needed and UTF-8 text survives untouched.
#
# Uses --clean --if-exists, so it is safe to re-run: existing tables in Neon are
# dropped and recreated from the local data.

param(
    [Parameter(Mandatory = $true)]
    [string]$NeonUrl
)

$container = 'ats_expense_db'

$running = docker ps --filter "name=$container" --format '{{.Names}}'
if ($running -ne $container) {
    Write-Error "Container '$container' is not running. Start it with: docker compose up -d"
    exit 1
}

Write-Host 'Dumping local database inside the container...'
docker exec $container pg_dump -U ats -d ats_expenses --clean --if-exists --no-owner --no-privileges -f /tmp/ats_dump.sql
if ($LASTEXITCODE -ne 0) { Write-Error 'pg_dump failed.'; exit 1 }

Write-Host 'Restoring into Neon...'
docker exec $container psql $NeonUrl -v ON_ERROR_STOP=1 -f /tmp/ats_dump.sql
if ($LASTEXITCODE -ne 0) { Write-Error 'Restore into Neon failed.'; exit 1 }

docker exec $container rm -f /tmp/ats_dump.sql

Write-Host 'Verifying row counts in Neon...'
docker exec $container psql $NeonUrl -c "SELECT relname AS table, n_live_tup AS rows FROM pg_stat_user_tables ORDER BY relname;"

Write-Host ''
Write-Host 'Done. Point the backend at Neon by setting DATABASE_URL in backend\.env, then restart it.'
