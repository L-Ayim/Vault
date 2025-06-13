# Vault

**Vault** is a self‑hosted solution for organising files on an interactive map. It is composed of a Django backend exposed via GraphQL and a modern React frontend, all orchestrated with Docker Compose.

## Features

- Upload and categorise files
- Visualise documents on a dynamic map
- Real‑time updates via GraphQL subscriptions

## Technology Stack

- **Backend:** Django + Graphene + MySQL
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Deployment:** Docker Compose

## Getting Started

1. Ensure Docker Desktop (or Docker Engine) is installed.
2. **Windows** – run the helper script to generate a `.env` file and launch the stack:

   ```powershell
   ./start-vault.ps1
   ```

3. **macOS/Linux** – start the services with Docker Compose:

   ```bash
   docker compose up --build
   ```

4. Open the printed address in your browser to access the web interface.

### Resetting the Environment

To wipe all data and start fresh:

```powershell
./reset-vault.ps1
```
