# Vault

Vault is a simple tool for storing files and arranging them on an interactive map.

## Stack

- Django + Graphene + MySQL
- React + TypeScript + Vite + Tailwind
- Docker Compose

## Quick Start

1. Install Docker Desktop.
2. **Windows**:
   ```powershell
   ./start-vault.ps1
   ```
   The script creates a `.env` file and launches the containers.
3. **macOS/Linux**:
   ```bash
   docker compose up --build
   ```
4. Open the printed address in your browser.

To wipe all data and start fresh:
```powershell
./reset-vault.ps1
```
