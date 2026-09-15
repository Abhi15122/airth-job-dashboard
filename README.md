# AIRTH Mini Job Queue Dashboard

A small dashboard for creating jobs, tracking their status, and deleting them. Status rules are enforced by conditional PostgreSQL updates, including when two clients send competing requests.

## Features

- Create jobs with React Hook Form and client/server validation.
- List jobs newest first, filter by status, and show counts across the complete queue.
- Start pending jobs; complete or fail running jobs. Terminal jobs cannot restart.
- Confirm deletions, show loading/error states, preserve failed form submissions, and refresh stale data after conflicts.
- Persist records in PostgreSQL with versioned migrations.
- Check API/database readiness at `GET /health`.

## Live links

- Repository: [Abhi15122/airth-job-dashboard](https://github.com/Abhi15122/airth-job-dashboard)
- Frontend: [AIRTH Dashboard](https://airth-job-dashboard.vercel.app)
- Backend: [API health](https://airth-job-dashboard.onrender.com/health)

## Stack and scope

| Layer | Choice |
| --- | --- |
| Frontend | React + TypeScript + Vite, React Hook Form, Tailwind CSS |
| Backend | NestJS + TypeScript, class-validator/class-transformer |
| Persistence | PostgreSQL on Neon, `pg` with parameterized SQL |
| Hosting configuration | Vercel frontend, Render backend, Neon database |

```text
React form -> fetch JSON -> NestJS controller -> validation pipe
           -> JobsService -> PostgreSQL -> JSON -> React state
```

The repository has independent `frontend/` and `backend/` npm packages and lockfiles. No ORM, queue worker or monorepo tooling is required.

## Local backend setup (PowerShell)

Use Node **22.19.0** (also pinned in `.nvmrc`). Clone the repository, open its root folder, then:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Copy `.env.example` only on first setup; do not overwrite an existing `.env`. On macOS/Linux use `cp .env.example .env`.

Set `DATABASE_URL` in `backend/.env` to the dedicated application database connection string, retaining Neon's TLS parameters. Keep `FRONTEND_ORIGIN=http://localhost:5173` for local development. Never put a database URL in the frontend. `.env` files are ignored by Git.

```powershell
npm run migrate
npm run build
npm start
```

For development use `npm run dev`. The API listens on port 3000 by default.

## Local frontend setup

Open a second terminal from the repository root:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`. `VITE_API_URL` defaults to `http://localhost:3000`; set it in `frontend/.env` when using another backend. Vite reads this value at build time, so rebuild after changing a deployed API URL.

To inspect the production frontend build locally:

```powershell
npm run build
npm run preview -- --port 5173 --strictPort
```

## Environment variables

| Variable | Where | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | Backend | Application PostgreSQL URL; required |
| `FRONTEND_ORIGIN` | Backend | Exact allowed browser origin, including protocol and port; no trailing slash |
| `PORT` | Backend | HTTP port; defaults to 3000, supplied by Render in hosting |
| `VITE_API_URL` | Frontend | Backend base URL, without `/jobs`; no credentials |

## Implemented API

| Endpoint | Request | Success |
| --- | --- | --- |
| POST /jobs | JSON with title and type | 201, created job |
| GET /jobs | No body | 200, array ordered newest first |
| PATCH /jobs/:id/status | JSON with status | 200, updated job |
| DELETE /jobs/:id | No body | 204, empty response |
| GET /health | No body | 200 when the database responds; 503 otherwise |

```powershell
Invoke-RestMethod http://localhost:3000/jobs -Method Post -ContentType 'application/json' -Body '{"title":"Sales report","type":"report"}'
Invoke-RestMethod http://localhost:3000/jobs
```

Jobs contain `id`, `title`, `type`, `status`, and ISO `createdAt`. The backend generates UUIDs. PostgreSQL supplies initial `pending` status and creation time. Title is trimmed to 1–120 characters; type to 1–50. Invalid, missing, non-string, blank, or unexpected fields return 400. SQL uses parameters instead of interpolating client values. Database constraints also protect stored values.

Example response:

```json
{
  "id": "bcad4a00-06d3-4a28-a2e4-bd9dcefe0a01",
  "title": "Sales report",
  "type": "report",
  "status": "pending",
  "createdAt": "2026-09-15T10:00:00.000Z"
}
```

Only `title` and `type` are accepted on create; only `status` is accepted on update. Supplied IDs, timestamps, initial statuses, and other unexpected properties are rejected. Malformed UUIDs return **400**, missing jobs **404**, and disallowed transitions **409**. Unexpected server failures return **500** without SQL or connection details.

## Status rules and concurrent requests

```text
pending -> running -> completed
                   -> failed
```

Rules live in the backend. Disabling React buttons is useful feedback but cannot protect the API from direct requests or another tab.

The service performs one conditional SQL update:

```sql
UPDATE jobs SET status = $2
WHERE id = $1 AND (
  (status = 'pending' AND $2 = 'running') OR
  (status = 'running' AND $2 IN ('completed', 'failed'))
)
RETURNING ...;
```

PostgreSQL locks the row and rechecks the condition after a competing update. If two requests try to start one pending job, one succeeds; the other no longer matches `pending` and receives 409. Competing complete/fail requests also have exactly one winner. A follow-up existence query distinguishes missing jobs (404) from conflicts (409).

An unconditional read-then-write would allow both clients to act on the same stale state. The conditional update avoids that race without a distributed lock. Valid successive transitions can both succeed if they occur in a valid order; the goal is to preserve the state machine, not reject all simultaneous traffic.

The UI refreshes on window focus, after successful changes, and after a 404/409. It does not optimistically claim a status change before the server accepts it. A request version prevents older list responses from overwriting newer state. This is not real-time push synchronization.

## Build verification

Run `npm run build` in both `backend/` and `frontend/`. GitHub Actions runs these builds on pushes and pull requests.

## Production-readiness bonus: database readiness check

`GET /health` executes `SELECT 1`. It returns `{ "status": "ok", "database": "up" }` only when the database is reachable, otherwise 503 without exposing database details. Render uses this endpoint as its health check. A process can be alive while its database is unavailable; this check distinguishes those cases with a small, testable change.

## Deploy on Render and Vercel

First push this repository to a **public GitHub repository**. The configuration uses free hosting plans.

### Backend: Render

Import the repository as a Blueprint using `render.yaml`, or create a Node Web Service with:

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Instance plan | Free |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm run migrate && npm start` |
| Health check path | `/health` |
| Node version | `22.19.0` |

Add `DATABASE_URL` as a secret environment variable and `FRONTEND_ORIGIN` as the deployed frontend origin. Render supplies `PORT`; the app listens on `0.0.0.0`.

The migration runner records applied SQL files in a transaction, with a transaction-scoped advisory lock to serialize deployment migrations. Running it again is safe; it does not drop or recreate live data. Render Free has no dedicated pre-deploy command, so the start command runs migrations before starting the API.

### Frontend: Vercel

Import the same repository with Root Directory **frontend**, Framework **Vite**, Build Command **npm run build**, and Output Directory **dist**. Set `VITE_API_URL` to the Render backend base URL, then deploy. Use the stable Vercel production origin as Render's `FRONTEND_ORIGIN`; update and redeploy the backend if needed. Preview origins are not allowed automatically.

Verify the backend `/health`, then create, start, complete/fail and delete a disposable job through the deployed frontend. Reload to confirm persistence. Record the real public links above after verification.

Free Render services sleep after inactivity, so the first request can take longer. The frontend shows loading and offers retry on timeout; mutations are never retried automatically. See [Render's free-tier documentation](https://render.com/docs/free).

## Assumptions, trade-offs, and future improvements

- Controllers handle HTTP; DTO decorators validate input; the service runs application queries; dependency injection supplies one shared database pool.
- Versioned migrations run explicitly and record applied files transactionally. Startup never drops or recreates tables.
- The pool has connection timeouts and closes on graceful shutdown.
- Jobs are records with manually controlled statuses. There is no actual report generation, email sending, automatic worker, scheduler, or Redis queue.
- Type is free text because no fixed categories were specified. Duplicate titles are allowed. Deleting any status is allowed; repeated deletion returns 404. Repeating a status transition returns 409 rather than treating it as a successful no-op.
- This is a shared assessment demo without user accounts. Anyone who can reach the API can change its records; CORS is not authentication. Use non-sensitive demonstration data.
- Filtering and counts use the same complete client-side list. This keeps them consistent for a small dashboard; pagination and database-side aggregation would be the next change for a large queue.
- NestJS 11 and exact package versions are pinned for a small CommonJS/TypeScript setup. Its transitive Multer dependency is overridden to patched 2.3.0; no upload routes are exposed. Recheck this override when upgrading NestJS.
- With more time: authentication/ownership, rate limiting, pagination, structured request IDs and metrics, migration checksums, an audit trail for status changes, and idempotency keys for safe create retries. Add workers only if executing jobs becomes a requirement.
