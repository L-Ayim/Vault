# start-vault-prod.ps1
# ────────────────────────────────────────────────────────────────────────
# 1. Prompt for production domain and secrets
$domain = Read-Host "Enter production domain (e.g. vault.example.com)"
$djangoSecret = Read-Host "Enter DJANGO_SECRET_KEY"
$jwtSecret = Read-Host "Enter GRAPHENE_JWT_SECRET"
$mysqlPassword = Read-Host "MySQL password [s3cr3tpass]"
if (-not $mysqlPassword) { $mysqlPassword = 's3cr3tpass' }

# 2. Write backend/.env for Django
$backendEnv = @(
    "DJANGO_SECRET_KEY=$djangoSecret",
    "DEBUG=False",
    "ALLOWED_HOSTS=$domain",
    "MYSQL_HOST=vault_db",
    "MYSQL_PORT=3306",
    "MYSQL_DATABASE=vault_db",
    "MYSQL_USER=vault_user",
    "MYSQL_PASSWORD=$mysqlPassword",
    "GRAPHENE_JWT_SECRET=$jwtSecret",
    "GRAPHENE_JWT_VERIFY_EXPIRATION=True"
)
$backendEnv | Set-Content -Path "./backend/.env" -Encoding UTF8

# 3. Write root .env for Docker Compose
$rootEnv = @(
    "CORS_ALLOWED_ORIGINS=https://$domain",
    "CSRF_TRUSTED_ORIGINS=https://$domain",
    "VITE_GRAPHQL_URL=https://$domain/graphql/",
    "VITE_GRAPHQL_WS_URL=wss://$domain/graphql/"
)
$rootEnv | Set-Content -Path "./.env" -Encoding UTF8

# 4. Build frontend and copy assets
Push-Location ./frontend
npm run build
Pop-Location

Copy-Item -Path ./frontend/dist/index.html -Destination ./backend/templates/index.html -Force
Copy-Item -Recurse -Force -Path ./frontend/dist/assets -Destination ./backend/staticfiles/
Get-ChildItem ./frontend/dist/*.svg | ForEach-Object { Copy-Item $_.FullName ./backend/staticfiles/ -Force }

# 5. Launch Docker Compose
docker compose up --build
