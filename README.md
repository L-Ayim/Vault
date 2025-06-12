# Vault

Vault is a full-stack application featuring:

- **User accounts & profiles** (sign up, log in, profile visibility, avatar, bio)  
- **File storage & sharing** (upload/download, versioning, permissions)  
- **Graph-based “Map” view** (nodes/edges, attach files to nodes, dynamic GraphQL operations)  
- **Chat functionality** (channels for direct messaging and node discussions, file attachments)  
- **Settings** (view profile info)

The backend is built with Django + Graphene (GraphQL) + MySQL. The frontend uses Vite + React + TypeScript + Tailwind, with Apollo Client for GraphQL. Docker Compose orchestrates all services for easy local development.

---

## Table of Contents

1. [Features](#features)  
2. [Prerequisites](#prerequisites)  
3. [Repository Structure](#repository-structure)  
4. [Environment Variables](#environment-variables)  
5. [Getting Started with Docker](#getting-started-with-docker)  
6. [Running Without Docker (Optional)](#running-without-docker-optional)  
7. [Available Scripts](#available-scripts)  
8. [Folder Breakdown](#folder-breakdown)  
9. [Contributing](#contributing)  
10. [License](#license)  

---

## Features

- **Authentication & Authorization**
  - JWT-based login/signup
  - Profile (avatar upload/URL, bio, public/private toggle)
- **File Management**  
  - Upload new files, view/download versions  
  - Share with users or groups  
  - Public file listing  
- **Graph “Map”**
  - CRUD Nodes & Edges
  - Attach files to nodes
  - Interactive React Flow canvas with draggable nodes and connectable edges
  - Long-press items on mobile to drag with a preview overlay
- **Chat**  
  - Direct (1:1) channels  
  - Node-specific discussion channels  
  - Send text messages and attachments  
- **Settings**  
  - View profile, email, bio, visibility  

---

## Prerequisites

- **Docker** (v20.10+) & **Docker Compose** (v1.29+).  
- (Optional, if running without Docker)  
  - **Python 3.10+** and **pip**  
  - **Node.js 18+** and **npm**  

---

## Repository Structure

```
Vault/
├─ backend/                      # Django + Graphene backend
│  ├─ Dockerfile
│  ├─ requirements.txt
│  ├─ .env                        # Environment variables (not committed)
│  ├─ manage.py
│  ├─ vault/                      # Django project folder
│  │  ├─ settings.py
│  │  ├─ urls.py
│  │  └─ ...
│  ├─ accounts/                   # Django “accounts” app (users/profiles/invites)
│  ├─ files/                      # Django “files” app (uploads/shares)
│  ├─ graph/                      # Django “graph” app (nodes/edges)
│  └─ chat/                       # Django “chat” app (channels/messages)
│
├─ frontend/                     # Vite + React + TypeScript frontend
│  ├─ Dockerfile
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ vite.config.ts
│  ├─ tailwind.config.js
│  ├─ postcss.config.js
│  └─ src/
│     ├─ main.tsx                # React entrypoint
│     ├─ apolloClient.ts         # Apollo Client setup
│     ├─ auth/
│     │  ├─ AuthContext.tsx      # JWT handling & user state
│     │  └─ ProtectedRoute.tsx
│     ├─ graphql/
│     │  └─ operations.ts        # All GraphQL queries & mutations
│     ├─ pages/
│     │  ├─ HomePage.tsx
│     │  ├─ LoginPage.tsx
│     │  ├─ SignupPage.tsx
│     │  ├─ DashboardPage.tsx
│     │  ├─ StoragePage.tsx
│     │  ├─ MapPage.tsx
│     │  ├─ ChatPage.tsx
│     │  ├─ SettingsPage.tsx
│     │  └─ NotFoundPage.tsx
│     └─ components/             # (Optional) shared UI components
│
├─ docker-compose.yml           # Orchestrates backend, frontend, and MySQL
├─ README.md                    # This file
└─ .gitignore
```

---

## Environment Variables

### Backend (`backend/.env`)

Create a file named `.env` under `backend/` with the following (example values):

\`\`\`ini
# Django
DJANGO_SECRET_KEY=your_django_secret_key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# MySQL (matches docker-compose.yml)
MYSQL_HOST=vault_db
MYSQL_PORT=3306
MYSQL_DATABASE=vault_db
MYSQL_USER=vault_user
MYSQL_PASSWORD=s3cr3tpass

# Graphene JWT
GRAPHENE_JWT_SECRET=your_jwt_secret
GRAPHENE_JWT_VERIFY_EXPIRATION=True

# (Optional) Any other Django settings (EMAIL_BACKEND, etc.)
\`\`\`

> **Important**: Do **not** commit \`.env\` to source control. Store secrets securely.

### Frontend

No additional \`.env\` file is needed locally, as \`docker-compose.yml\` passes:

\`\`\`
VITE_GRAPHQL_URL=http://vault_backend:8000/graphql/
# Optional: enable GraphQL subscriptions
VITE_GRAPHQL_WS_URL=ws://vault_backend:8000/graphql/
CHOKIDAR_USEPOLLING=true
\`\`\`

If running frontend outside Docker, set in your shell:

\`\`\`bash
export VITE_GRAPHQL_URL=http://localhost:8000/graphql/
export VITE_GRAPHQL_WS_URL=ws://localhost:8000/graphql/
export CHOKIDAR_USEPOLLING=true
\`\`\`

### Docker Compose `.env`

The `start-vault.ps1` script writes a `.env` file in the project root. It now
includes `CSRF_TRUSTED_ORIGINS`, which tells Django which origins are allowed to
make CSRF-protected requests. By default this is set to
`http://${HOST_IP}:5173` for local development. Change the value if your
frontend runs on a different host or port. After editing `.env`, restart Docker
Compose so the containers pick up the new settings.

---

## Getting Started with Docker

1. **Clone the repo** (on your local machine):
   \`\`\`bash
   git clone https://github.com/L-Ayim/Vault.git
   cd Vault
   \`\`\`

2. **Build and start all containers**:
   \`\`\`bash
   docker compose up --build
   \`\`\`
   - **vault_db**: MySQL 8.0 on port \`3306\`  
   - **vault_backend**: Django GraphQL server on port \`8000\`  
   - **vault_frontend**: Vite dev server on port \`5173\`  

3. **Verify everything is running**:
   - Open \`http://localhost:5173/\` → Frontend  
   - Open \`http://localhost:8000/graphql/\` → GraphiQL Playground  

4. **Run migrations (if needed)**:
   In a separate terminal:
   \`\`\`bash
   docker compose exec vault_backend bash
   python manage.py migrate
   exit
   \`\`\`

5. **Access the app**:
   - **Sign Up / Log In**: \`http://localhost:5173/signup\` and \`http://localhost:5173/login\`  
   - **Dashboard**: \`http://localhost:5173/dashboard\` (protected)  
   - **Storage**: \`http://localhost:5173/storage\`  
   - **Map**: \`http://localhost:5173/map\`  
   - **Chat**: \`http://localhost:5173/chat\`  
   - **Settings**: \`http://localhost:5173/settings\`  

6. **Stop containers**:
   \`\`\`bash
   docker compose down
   \`\`\`

---

## Running Without Docker (Optional)

> If you prefer to run services locally instead of via Docker, follow these steps.

### Backend

1. **Create & activate a Python virtual environment**:
   \`\`\`bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate       # Linux / macOS
   # Windows PowerShell: .\venv\Scripts\Activate.ps1
   \`\`\`

2. **Install dependencies**:
   \`\`\`bash
   pip install --upgrade pip
   pip install -r requirements.txt
   \`\`\`

3. **Create or copy \`.env\`** (see [Environment Variables](#environment-variables)).

4. **Run migrations & start server**:
   \`\`\`bash
   python manage.py migrate
   # Use Daphne so WebSocket subscriptions work
  daphne -b 0.0.0.0 -p 8000 vault.asgi:application
   \`\`\`
   The backend will be available at \`http://127.0.0.1:8000/\`.

### Frontend

1. **Install Node dependencies**:
   \`\`\`bash
   cd ../frontend
   npm install
   \`\`\`

2. **Set environment variable** (point Apollo to your local Django):
   \`\`\`bash
   export VITE_GRAPHQL_URL=http://127.0.0.1:8000/graphql/
   export VITE_GRAPHQL_WS_URL=ws://127.0.0.1:8000/graphql/
   export CHOKIDAR_USEPOLLING=true
   # Windows PowerShell:
   # $env:VITE_GRAPHQL_URL="http://127.0.0.1:8000/graphql/"
   # $env:VITE_GRAPHQL_WS_URL="ws://127.0.0.1:8000/graphql/"
   # $env:CHOKIDAR_USEPOLLING="true"
   \`\`\`

3. **Start development server**:
   \`\`\`bash
   npm run dev
   \`\`\`
   The frontend will be available at \`http://localhost:5173/\`.

4. **Build for production & copy files**:
   ```bash
   npm run build
   cp dist/index.html ../backend/templates/index.html
   cp -r dist/assets ../backend/staticfiles/
   cp dist/*.svg ../backend/staticfiles/
   ```
   Now Django will serve the compiled React app at `/`.

---

## Available Scripts

### Backend (inside \`backend/\`)

- \`python manage.py migrate\`
- \`daphne -b 0.0.0.0 -p 8000 vault.asgi:application\` – start server with WebSocket support
- \`python manage.py createsuperuser\`
- \`python manage.py test\`

### Frontend (inside \`frontend/\`)

- \`npm install\`  
- \`npm run dev\` – Start Vite dev server on \`:5173\`  
- \`npm run build\` – Produce a production build (output in \`dist/\`)  
- \`npm run preview\` – Preview the production build on a local static server  

---

## Folder Breakdown

### \`backend/\`

- \`Dockerfile\` – Builds the Django container  
- \`requirements.txt\` – Python dependencies  
- \`.env\` – Django settings (not committed)  
- \`manage.py\` – Django CLI  
- \`vault/\` – Django project folder  
  - \`settings.py\`, \`urls.py\`, etc.  
- \`accounts/\` – Users, profiles, invites, friends, groups  
- \`files/\` – File upload, versioning, sharing  
- \`graph/\` – Node & edge models, GraphQL schema  
- \`chat/\` – Channels, messages, file attachments  

### \`frontend/\`

- \`Dockerfile\` – Builds the Vite/React container  
- \`package.json\`, \`package-lock.json\` – Node dependencies  
- \`tsconfig.json\` – TypeScript config  
- \`vite.config.ts\` – Vite settings  
- \`tailwind.config.js\` & \`postcss.config.js\` – TailwindCSS setup  
- \`src/\`  
  - \`main.tsx\` – Bootstraps React + Apollo + Router  
  - \`apolloClient.ts\` – Apollo Client initialization (includes JWT from \`localStorage\`)  
  - \`auth/\`  
    - \`AuthContext.tsx\` – Provides \`user\` & \`login\`/\`logout\` via React context  
    - \`ProtectedRoute.tsx\` – Redirects unauthenticated users to \`/login\`  
  - \`graphql/operations.ts\` – All GraphQL queries & mutations  
  - \`pages/\`  
    - \`HomePage.tsx\` – Landing page with “Log In” & “Sign Up” buttons  
    - \`LoginPage.tsx\`, \`SignupPage.tsx\` – Auth forms  
    - \`DashboardPage.tsx\` – Four cards (Storage, Map, Chat, Settings)  
    - \`StoragePage.tsx\` – File upload & list  
    - \`MapPage.tsx\` – React Flow canvas with custom nodes & edges  
    - \`ChatPage.tsx\` – Channels & message threads UI  
    - \`SettingsPage.tsx\` – View profile data  
    - \`NotFoundPage.tsx\` – 404 fallback  
  - \`components/\`             # (Optional) shared UI components  

---

## Contributing

1. Fork the repository (<https://github.com/L-Ayim/Vault>).  
2. Create a new feature branch:  
   \`\`\`bash
   git checkout -b feature/your-feature-name
   \`\`\`  
3. Make your changes (follow existing code style).  
4. Commit & push your branch:  
   \`\`\`bash
   git add .
   git commit -m "Describe your changes"
   git push origin feature/your-feature-name
   \`\`\`  
5. Open a Pull Request against \`main\`.  

Please include clear descriptions of any bug you fix or feature you add. Follow our code style:

- **Frontend**: React + TSX + Tailwind classes, use context/hooks, keep components small.  
- **Backend**: Django conventions (apps, models, serializers, Graphene schema).  

---

## License

This project is released under the **MIT License**. For details, see [LICENSE](LICENSE).
