# reset-vault.ps1
# ────────────────────────────────────────────────────────────────────

# 1) Stop and remove containers (volumes stay intact)
docker compose down

# 2) Drop & recreate the vault_db schema
docker compose run --rm vault_db `
  mysql -uroot -prootpass `
    -e "DROP DATABASE IF EXISTS vault_db; CREATE DATABASE vault_db;"

# 3) Remove all user-uploaded media
if (Test-Path "./backend/media") {
  Write-Host "Deleting backend/media…" -ForegroundColor Yellow
  Remove-Item -Recurse -Force "./backend/media/*"
}

Write-Host "Reset complete. You can now run:" -ForegroundColor Green
Write-Host "    .\\start-vault.ps1   # or docker compose up --build" -ForegroundColor Green
