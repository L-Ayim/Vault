# Vault

**Vault** is a self-hosted web application that lets you organise files on a visual map and share them with friends or groups. The project is split into a Django backend (GraphQL API and WebSocket subscriptions) and a React/Vite frontend.

## Features

- Upload files and keep multiple versions
- Organise files inside *nodes* on an interactive map
- Link nodes together with edges to build your own graph
- Share nodes and files publicly, with individual users, or with groups
- Invite friends and manage group membership
- Chat channels for direct messages, nodes and groups
- Real-time updates via GraphQL subscriptions

## Technology Stack

- **Backend:** Django, Graphene, Channels, MySQL
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Apollo Client
- **Deployment:** Docker Compose

## Repository Layout

- `backend/` – Django project with the GraphQL schema and WebSocket support
- `frontend/` – React application using Apollo Client for GraphQL
- `docker-compose.yml` – services for MySQL, Django and Vite
- `start-vault.ps1` / `reset-vault.ps1` – helper scripts for Windows

## Getting Started

1. Ensure Docker Desktop (or Docker Engine) is installed.
2. **Windows** – run the helper script to create a `.env` file and launch the stack:

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
