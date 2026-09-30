# CapybaraStudy

CapybaraStudy is a cozy study assistant with a focus timer, task rewards, an animated capybara, and AI-generated study material.

## Requirements

- Node.js 22
- npm
- PostgreSQL 16 or a managed Postgres database
- A Gemini or OpenAI API key for AI study generation

## Backend setup

```powershell
npm install
Copy-Item backend/.env.example backend/.env
```

Set `JWT_SECRET` and `DATABASE_URL` in `backend/.env`. Gemini is preferred when `GEMINI_API_KEY` is set; otherwise the service uses `OPENAI_API_KEY` when available. Then generate the client, apply migrations, seed the local demo account, and start both apps:

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed --workspace backend
npm run dev:api
# in another terminal
npm run dev
```

The API listens on `http://localhost:5000`; Vite normally uses `http://localhost:5173`. The local seed account uses `DEMO_EMAIL` and `DEMO_PASSWORD` from `.env.example` unless overridden. Change those values before using the seed outside local development.

## Frontend setup

The frontend runs from the root workspace:

```powershell
npm run dev
```

Vite prints the local URL, normally `http://localhost:5173`. In production, API calls use the same-origin Vercel function route.

## Vercel deployment

Import this repository into Vercel with the repository root as the project root and Node.js 22. `vercel.json` builds the Vite site, routes `/api/*` to the Express function, and rewrites client-side routes to the SPA. The build deploys the additive Prisma migration before building the frontend.

Configure these Vercel environment variables for Production (and Preview if needed):

- `DATABASE_URL`: the existing Postgres connection string.
- `JWT_SECRET`: a long, stable signing secret.
- `GEMINI_API_KEY` or `OPENAI_API_KEY`: server-only tutor credentials. Gemini is preferred if both are set.
- `MODEL_NAME` and `OPENAI_MODEL`: optional provider model names.

The migration creates separate `Capybara*` tables and leaves the old app tables untouched. Never add real credentials to GitHub.

## Environment variables

Backend variables are documented in `backend/.env.example`:

- `DATABASE_URL`: PostgreSQL connection URL.
- `JWT_SECRET`: signing secret for the httpOnly session cookie.
- `FRONTEND_URL`: allowed frontend origin (comma-separated origins are supported).
- `GEMINI_API_KEY`: server-only Gemini credential; never put this in the frontend environment.
- `MODEL_NAME`: Gemini model name used by the tutor.
- `OPENAI_API_KEY`, `OPENAI_MODEL`, and `LLM_PROVIDER`: optional OpenAI fallback configuration.
- `PORT`: backend port.
- `DEMO_EMAIL` and `DEMO_PASSWORD`: optional local seed account credentials.

## Checks

```powershell
# backend
npm run typecheck

# frontend
npm run build
```
