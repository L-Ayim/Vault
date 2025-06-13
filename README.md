# Vault

Vault is a file repository that lets you place files on an interactive map. The backend exposes a GraphQL API powered by Django while the frontend is built with React and Vite. The entire stack can be launched locally using Docker Compose.

## Features

- Store and organize files
- Interactive map interface
- Real-time updates via WebSockets
- GraphQL API with JWT authentication

## Technology Stack

- **Backend**: Django, Graphene, MySQL
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Infrastructure**: Docker Compose

## Getting Started

1. Install **Docker Desktop**.
2. On **Windows**, run:
   ```powershell
   ./start-vault.ps1
   ```
   This script creates an `.env` file and starts the containers.
3. On **macOS/Linux**, run:
   ```bash
   docker compose up --build
   ```
4. Once the services have started, open the printed address in your browser to access the UI.

To reset the environment and remove uploaded data:
```powershell
./reset-vault.ps1
```
