# reset-vault.ps1
# ────────────────────────────────────────────────────────────────────

# 1) Stop & remove containers **and** volumes
Write-Host "Stopping all containers & removing associated volumes…" -ForegroundColor Cyan
docker compose down --volumes

# 2) (Optional) prune any dangling volumes
# docker volume prune -f

# 3) Remove user-uploaded media from disk
if (Test-Path "./backend/media") {
    Write-Host "Deleting backend/media…" -ForegroundColor Yellow
    Remove-Item -Recurse -Force "./backend/media/*"
}

Write-Host ""
Write-Host " Vault database & media wiped clean." -ForegroundColor Green
Write-Host "Now rebuild everything with:" -ForegroundColor Green
Write-Host "    docker compose up --build" -ForegroundColor Green
Write-Host "or run your start-vault.ps1 if you have one." -ForegroundColor Green
