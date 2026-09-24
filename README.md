# 🎓 AI Study Assistant

A full-stack study app that helps you learn any topic with AI: conversational
explanations, structured notes, quizzes, and day-by-day study plans — all saved
per-user in PostgreSQL, so you can come back to them later.

Built with **Next.js (App Router) + Tailwind CSS + PostgreSQL (Prisma ORM)** and
the **OpenAI SDK** (server-side only). Includes custom auth (bcrypt + JWT),
streaming-free but debounced generation with rate limiting, file upload
(`.txt` / `.pdf`) to ground answers in your documents, and Markdown export /
print.

## ✨ Features

- **Auth** — register/login with bcrypt-hashed passwords and signed JWT session
  cookies; every API route re-verifies the session server-side.
- **Chat** — ask follow-up questions; the assistant remembers the last 12
  messages plus the topic, difficulty, and uploaded document text.
- **Generate 4 modes** — each with its own system prompt tuned to the topic,
  difficulty, and source document:
  - `Explain` — a clear explanation lands in the chat.
  - `Notes` — concise, scannable Markdown notes.
  - `Quiz` — 5–8 multiple-choice questions with explanations (strict JSON).
  - `Plan` — a day-by-day study plan sized to difficulty (JSON).
- **Persistence** — users, conversations, messages, notes, quizzes, and plans
  live in PostgreSQL. One active note/quiz/plan per conversation (regenerate to
  replace).
- **Multiple conversations** — sidebar navigation, mobile drawer, auto-redirect
  to your latest conversation.
- **File upload** — upload `.txt` or `.pdf` (≤5 MB); text is extracted
  server-side and used as the grounding source for all generations.
- **Export** — download any note/quiz/plan as Markdown, or Print / save as PDF
  directly from the conversation view.
- **Loading & error states** — skeletons, spinners, typed error banners with
  retry, and rate-limit responses.
- **Mock mode** — `LLM_MOCK=true` returns canned responses so the entire flow is
  testable without an OpenAI key.

## 🧱 Stack

| Layer    | Choice                                                              |
| -------- | ------------------------------------------------------------------- |
| Frontend | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4        |
| Backend  | Next.js Route Handlers (`app/api/**`)                               |
| Database | PostgreSQL 16 with Prisma ORM 7 (`@prisma/adapter-pg`)              |
| Auth     | Custom: bcryptjs hashing + JWT session cookie (HttpOnly)            |
| AI       | OpenAI SDK (`gpt-4o-mini` by default), key read server-side only    |
| Uploads  | `pdf-parse` for PDFs, UTF-8 text extraction for `.txt`              |

## 🚀 Getting started

### 1. Prerequisites

- Node.js 20+
- PostgreSQL 16 — either Docker, or the portable binaries (`scripts/` below)

### 2. Install & configure

```bash
npm install
copy .env.example .env      # Windows
cp .env.example .env        # macOS / Linux
```

Then edit `.env`:

```env
DATABASE_URL="postgresql://aistudy:aistudy@localhost:5432/aistudy?schema=public"
JWT_SECRET="<openssl rand -base64 48>"
OPENAI_API_KEY="sk-..."     # optional in mock mode
OPENAI_MODEL="gpt-4o-mini"  # optional
LLM_MOCK="false"            # "true" to test without an API key
```

**Never commit real secrets** — `.env*` is gitignored (`.env.example` is the
tracked template).

### 3. Start PostgreSQL

**Option A — Docker**

```bash
docker compose up -d db
npx prisma migrate deploy
```

**Option B — portable binaries (no Docker / no admin rights)**

```bash
# one-time setup: initdb, create role/db, apply migrations
powershell -ExecutionPolicy Bypass -File scripts\db-init.ps1
# afterwards, start/stop the server:
powershell -ExecutionPolicy Bypass -File scripts\db-start.ps1
powershell -ExecutionPolicy Bypass -File scripts\db-stop.ps1
```

The scripts default to `%LOCALAPPDATA%\Programs\postgres` (pass `-PgBin` /
`-DataDir` / `-Port` to override). The server is launched as a detached WMI
process so it keeps running after the shell exits.

### 4. Run

```bash
npm run dev       # http://localhost:3000
# or
npm run build && npm start
```

Generate the Prisma client after schema changes:

```bash
npx prisma generate && npx prisma migrate dev --name <name>
```

## 🌍 Deploying

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for step-by-step production guides:
Vercel + managed Postgres (recommended), Docker on a VPS, or Railway/Render.
Your live instance needs `DATABASE_URL`, `JWT_SECRET`, and (for real AI)
`OPENAI_API_KEY` — everything else has defaults.

## 🧭 Project structure

```
app/
  page.tsx                 # "/" → redirect to /app or /login
  layout.tsx               # root layout + fonts
  (auth)/                  # login + register pages
  app/                     # authenticated area
    layout.tsx             # app shell (sidebar + drawer)
    page.tsx               # home / auto-redirect to latest conversation
    [id]/page.tsx          # conversation view (chat, generate, notes/quiz/plan)
  api/
    register|login|logout|me
    conversations/         # list + create (GET/POST)
    conversations/[id]     # detail
    conversations/[id]/messages   # chat
    conversations/[id]/export     # Markdown download
    generate              # explain | notes | quiz | plan
    upload                # .txt / .pdf
components/               # UI primitives + chat/sidebar/quiz/plan/markdown
lib/
  auth.ts  db.ts  llm.ts  prompts.ts  rate-limit.ts  validation.ts
  api-client.ts  conversations.ts  errors.ts  export.ts  handler.ts  types.ts
prisma/                   # schema + migrations (Prisma ORM 7 config)
scripts/                  # db-init / db-start / db-stop (portable PostgreSQL)
```

## 🔌 API overview

All endpoints require the session cookie (set by login/register) unless noted.
Errors are JSON: `{ "error": { "message", "code", "retryable" } }`.

| Method | Route                              | Purpose                                  |
| ------ | ---------------------------------- | ---------------------------------------- |
| POST   | `/api/register`                    | Create account (sets session cookie)     |
| POST   | `/api/login`                       | Sign in (sets session cookie)            |
| POST   | `/api/logout`                      | Clear session                            |
| GET    | `/api/me`                          | Current user                             |
| GET    | `/api/conversations`               | List my conversations                    |
| POST   | `/api/conversations`               | Create (topic + difficulty)              |
| GET    | `/api/conversations/:id`           | Detail incl. messages, note, quiz, plan  |
| POST   | `/api/conversations/:id/messages`  | Send a chat message (AI reply)           |
| GET    | `/api/conversations/:id/export?type=` | Download notes/quiz/plan as Markdown  |
| POST   | `/api/generate`                    | `mode: explain\|notes\|quiz\|plan`       |
| POST   | `/api/upload`                      | multipart `.txt`/`.pdf` → new conversat. |

## 🔒 Security notes

- OpenAI key and `JWT_SECRET` live only in the server environment; they are
  never sent to the browser.
- Passwords are hashed with bcrypt; session tokens are signed JWTs in HttpOnly,
  SameSite cookies.
- Ownership is enforced per request (`requireOwnedConversation`).
- Input is validated with zod on the server; AI output for quiz/plan is parsed
  and shape-checked before saving.
- Rate limiting: auth 15/min/IP, generate 15/min/user, chat 30/min/user,
  upload 10/min/user, create 20/min/user.
- Chat markdown is escaped before rendering — no dangerous HTML injection.

## 🧪 Mock mode

With `LLM_MOCK="true"` (or no `OPENAI_API_KEY`), every AI call returns
deterministic canned content so you can exercise the full flow offline.
The UI shows a small “mock mode” notice when it receives sample output.

## ⚠️ Notes for this codebase

- **Next.js 16 breaking changes are respected**: route handlers read `await
  ctx.params`; `middleware.ts` is `proxy.ts`; `cookies()`/`params` are async;
  Turbopack is the default bundler.
- **Prisma 7** uses driver adapters (`@prisma/adapter-pg` + `pg`), the
  `prisma-client` generator with an explicit output (`generated/prisma`), and
  `prisma7.config.ts`. JSON fields are cast when reading/writing.