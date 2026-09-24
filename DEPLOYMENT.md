# 🚀 Deployment Guide — AI Study Assistant

This guide walks through deploying the app to production. Pick one path:

| Option | Best for | Effort |
| ------ | -------- | ------ |
| **A — Vercel + managed Postgres** | Simplest, free tiers, zero server admin | Low |
| **B — Docker on a VPS** | You want full control / your own server | Medium |
| **C — Railway / Render** | PaaS with a built-in Postgres add-on | Low |

> **Before you start** — everything the app needs at runtime is in **environment
> variables**; there is no persistent filesystem, so it is serverless-friendly.
> Files aren't stored on disk — uploaded `.txt`/`.pdf` text is parsed server-side
> and saved to PostgreSQL, and exports are generated on request.

---

## 0. What the app needs in production

All secrets stay server-side (never shipped to the browser):

| Variable             | Required | Example / how to generate                                    |
| -------------------- | -------- | ------------------------------------------------------------ |
| `DATABASE_URL`       | ✅       | `postgresql://user:pass@host:5432/db?sslmode=require`        |
| `JWT_SECRET`         | ✅       | `openssl rand -base64 48` (or PowerShell `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))`) |
| `OPENAI_API_KEY`     | for real AI | `sk-...` from platform.openai.com                         |
| `OPENAI_MODEL`       | no (default) | `gpt-4o-mini`                                             |
| `LLM_MOCK`           | no (default `false`) | `"true"` → canned responses, no key needed        |

Notes:

- Prisma 7 runtime uses the **`pg` driver adapter** → the app must run on the
  **Node.js runtime** (it already does; no edge runtime is used anywhere).
- `generate` sets `maxDuration = 90`, `upload` sets `maxDuration = 60`. Vercel's
  **Hobby plan (fluid compute) allows up to 300s**, so no plan change is needed.
- Next.js 16 requires **Node.js ≥ 20.9** — use Node 22 on the platform.

---

## Option A — Vercel + Neon Postgres (recommended)

### A1. Push the code to GitHub

```bash
git remote add origin git@github.com:<you>/aistudy.git   # or create the repo first
git push -u origin master
```

### A2. Create a managed Postgres database

1. Sign up at [neon.tech](https://neon.tech) (free tier is plenty) and create a
   **project**.
2. Copy the **connection string** for the database
   (it looks like `postgresql://user:password@ep-...aws.neon.tech/neondb?sslmode=require`).
   Prefer a **direct** connection string (not a pooled `-pooler` one).

> Supabase works too: use the **direct** connection (port 5432), not the
> PgBouncer/pooler one — Prisma + PgBouncer needs extra configuration.

### A3. Apply migrations to the production database

The generated Prisma client is gitignored, so it's regenerated at build time —
but the **schema migrations must be applied to the prod DB once**. Run from your
local repo (set `DATABASE_URL` in the shell first; the local `.env` won't
override it):

```powershell
# PowerShell
$env:DATABASE_URL = "postgresql://user:password@ep-...neon.tech/neondb?sslmode=require"
npx prisma migrate deploy
```

```bash
# macOS / Linux
DATABASE_URL="postgresql://user:password@ep-...neon.tech/neondb?sslmode=require" \
  npx prisma migrate deploy
```

Verify with `npx prisma migrate status`.

> **Every time the schema changes** you must deploy migrations again — A6 shows
> how to automate this with GitHub Actions.

### A4. Import the repo on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) → **Import** the GitHub repo.
2. Framework preset auto-detects **Next.js**. Leave the build settings at their
   defaults:
   - Build command: **already** `prisma generate && next build` (set in
     `package.json`), so nothing to change.
   - Install command: `npm install`.
   - Node.js version: **22.x** (Project Settings → General).
3. Under **Environment Variables**, add (but do **not** check "Preview"/"Development"
   for secrets — or set them per-environment as you prefer):

   ```
   DATABASE_URL   = <prod connection string from A2>
   JWT_SECRET     = <fresh random value>
   OPENAI_API_KEY = <your key>      (leave blank to use mock mode)
   OPENAI_MODEL   = gpt-4o-mini
   LLM_MOCK       = false
   ```

   ⚠️ Use a **new** `JWT_SECRET` for production (never reuse one that shipped in
   a repo). Changing `JWT_SECRET` later signs everyone out — that's fine, users
   just log back in.

4. Click **Deploy**. Vercel runs `npm install` → `prisma generate && next build`
   → serves `next start`.

### A5. Verify

- `https://<project>.vercel.app` → register → create a conversation → send a
  chat message → generate notes/quiz/plan.
- If pages show the amber **“mock mode”** notice, `LLM_MOCK` is `true` or
  `OPENAI_API_KEY` is unset — the AI responses are canned.
- Check `https://<project>.vercel.app/api/me` returns your user JSON.
- Upload a `.pdf` and confirm the conversation gets grounded source text.

### A6. (Recommended) Auto-deploy migrations on push

Prisma migrations don't run automatically on Vercel. Add this workflow so every
schema change reaches production:

`.github/workflows/migrate.yml`

```yaml
name: Deploy DB migrations
on:
  push:
    branches: [master]
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

Add `DATABASE_URL` as a **repository secret** (GitHub → Settings → Secrets).

---

## Option B — Docker on a VPS (or your own machine)

A `Dockerfile` is already included (multi-stage, Node 22 Alpine, runs
`prisma generate && next build` then `next start`).

### B1. Set up a server with Docker

Any VPS (DigitalOcean, Hetzner, a home box) with Docker + Docker Compose.
For a managed Postgres you can skip B2–B3 and point `DATABASE_URL` at a cloud
database (same string as Option A), then jump to B4.

### B2. Run PostgreSQL (or use managed)

The repo already has `docker-compose.yml` for the **local dev DB**. For a small
production box, add an `app` service next to `db` in a new
`docker-compose.prod.yml`:

```yaml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: aistudy
      POSTGRES_PASSWORD: aistudy
      POSTGRES_DB: aistudy
    volumes:
      - aistudy_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aistudy -d aistudy"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://aistudy:aistudy@db:5432/aistudy?schema=public
      JWT_SECRET: <openssl rand -base64 48>
      OPENAI_API_KEY: sk-...
      OPENAI_MODEL: gpt-4o-mini
      LLM_MOCK: "false"

volumes:
  aistudy_pgdata:
```

> Put the real `JWT_SECRET` / `OPENAI_API_KEY` in a `.env` next to the compose
> file or in your host's secrets manager — never commit them.

### B3. Apply migrations, then start

```bash
docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
docker compose -f docker-compose.prod.yml up -d --build
```

### B4. Put it behind HTTPS

The app sets an HttpOnly cookie (no `secure` flag, so it works on plain HTTP
too), but you want TLS in production:

- Caddy (simplest): `yourdomain.com { reverse_proxy app:3000 }`
- or nginx `proxy_pass http://127.0.0.1:3000` + certbot.

---

## Option C — Railway / Render

Both are one-command deploys from GitHub:

1. Create the project → connect the repo → it detects Next.js.
2. Add a **PostgreSQL** add-on/service and copy its connection string into the
   `DATABASE_URL` env var of the app service.
3. Set the other env vars from the table in §0.
4. Build command: `npm run build` (already runs `prisma generate`), start
   command: `npm run start`.
5. Run `npx prisma migrate deploy` once (Railway: shell into the app service or
   a one-off command; Render: use a render.yaml `preDeployCommand`).

---

## 🔍 Post-deploy troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| Build fails: `@prisma/client did not initialize` or generated client missing | The gitignored client must be regenerated — confirm the build command is `prisma generate && next build` (it is, in `package.json`; refresh if Vercel cached an old build command). |
| `Error: DATABASE_URL is not set` | Missing env var on the platform — add it and redeploy. |
| 401s / "session invalid" after deploy, users logged out | `JWT_SECRET` was changed. Set it once and keep it stable (or accept re-login). |
| Amber "mock mode" notice in UI | `LLM_MOCK=true` or no `OPENAI_API_KEY`. Set `LLM_MOCK=false` and a valid key. |
| DB connection refused / SSL errors | Use `?sslmode=require` on the connection string; if the provider's TLS is odd, try `sslmode=no-verify`. Use a *direct* (non-pooled) URL with Prisma. |
| Slow generations appear to time out | Hobby allows 300s max → 60–90s is fine. If on an older Hobby plan, lower `maxDuration` to 60 or upgrade. |
| `429 Too Many Requests` | Rate limits (generate 15/min, chat 30/min). Wait a minute; this hits during automated smoke tests too. |
| PDF upload fails | `pdf-parse` v2 is pure JS and runs on the Node runtime. Check function logs; confirm `runtime` isn't edge (it isn't). |
| Cookie login works locally but not in prod | Prod is behind HTTPS; ensure the cookie isn't being stripped — the app uses `secure: false` + SameSite Lax, which works over HTTPS as long as the `session` cookie domain matches. |

---

## ✅ Production checklist

- [ ] `DATABASE_URL` points at the production database (not `localhost`)
- [ ] Migrations applied (`npx prisma migrate deploy` output "already applied" / success)
- [ ] Fresh, random `JWT_SECRET` (not the dev one)
- [ ] `OPENAI_API_KEY` set and `LLM_MOCK=false` (or intentionally left in mock mode)
- [ ] Site serves over HTTPS and `/` redirects to `/login` when logged out
- [ ] Register → chat → explain/notes/quiz/plan → export `.md` → print all work
- [ ] Upload a `.txt` and a `.pdf`, confirm generated content references the document
- [ ] (optional) GitHub Actions auto-migrates on push (A6)