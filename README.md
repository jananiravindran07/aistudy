# CapybaraStudy

CapybaraStudy is a cozy study assistant with a focus timer, task rewards, an animated capybara, and AI-generated study material.

## Requirements

- Node.js 20 or newer
- npm
- A Gemini API key for AI study generation (registration and the dashboard work without one)

## Backend setup

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Set `JWT_SECRET` to a long random value in `backend/.env`. Add your Gemini key to `GEMINI_API_KEY` to enable the tutor. Then initialize SQLite and the demo account:

```powershell
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

The API listens on `http://localhost:5000`. The local seed account uses `DEMO_EMAIL` and `DEMO_PASSWORD` from `.env.example` unless overridden. Change those values before using the seed outside local development.

## Frontend setup

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Vite prints the local URL, normally `http://localhost:5173`. The frontend uses `http://localhost:5000/api` by default; set `VITE_API_URL` only when the API is hosted elsewhere.

## Environment variables

Backend variables are documented in `backend/.env.example`:

- `DATABASE_URL`: Prisma connection URL; defaults to local SQLite.
- `JWT_SECRET`: signing secret for the httpOnly session cookie.
- `FRONTEND_URL`: allowed frontend origin (comma-separated origins are supported).
- `GEMINI_API_KEY`: server-only Gemini credential; never put this in the frontend environment.
- `MODEL_NAME`: Gemini model name used by the tutor.
- `PORT`: backend port.
- `DEMO_EMAIL` and `DEMO_PASSWORD`: optional local seed account credentials.

## Checks

```powershell
# backend
npm run typecheck

# frontend
npm run build
```

SQLite is convenient for local development. To use PostgreSQL, change the Prisma datasource provider and supply a PostgreSQL `DATABASE_URL`, then create a migration for that database.