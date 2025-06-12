# start-vault.ps1
# ────────────────────────────────────────────────────────────────────────

# 1. Auto-detect a 192.168.x.x IPv4 address (or prompt if none found)
$ip = $null

# Try Windows cmdlet first
try {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
          Where-Object { $_.IPAddress -match '^192\.168\.' } |
          Select-Object -First 1 -ExpandProperty IPAddress
} catch {
    # Ignore errors on non-Windows systems
}

# Fall back to cross-platform hostname -I
if (-not $ip) {
    $ip = (hostname -I 2>$null) -split ' ' |
          Where-Object { $_ -match '^192\.168\.' } |
          Select-Object -First 1
}

if (-not $ip) {
    Write-Warning "Could not auto-detect a 192.168.x.x address."
    $ip = Read-Host "Please enter your LAN IP (e.g. 192.168.1.42)"
}

# 2. Build & write the .env
$envLines = @(
    "HOST_IP=${ip}"
    "CORS_ALLOWED_ORIGINS=http://${ip}:5173"
    "CSRF_TRUSTED_ORIGINS=http://${ip}:5173"
    "VITE_GRAPHQL_URL=http://${ip}:8000/graphql/"
    "VITE_GRAPHQL_WS_URL=ws://${ip}:8000/graphql/"
)
$envLines | Set-Content -Path ".env" -Encoding UTF8

# 3. Display the LAN endpoints
Write-Host ""
Write-Host "Vault UI available at:"
Write-Host "  http://${ip}:5173"
Write-Host ""
Write-Host "GraphQL endpoint:"
Write-Host "  http://${ip}:8000/graphql/"
Write-Host "GraphQL WebSocket endpoint:"
Write-Host "  ws://${ip}:8000/graphql/"
Write-Host ""

# 4. Build images without cache to ensure dependencies are installed
docker compose build --no-cache
# 5. Launch Docker Compose
docker compose up
