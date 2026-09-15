# AIRTH Mini Job Queue Dashboard

Work in progress: the first backend slice implements creating and listing job records. Status updates, deletion, the React dashboard, and deployment are pending.

## Stack and scope

NestJS 11, TypeScript, PostgreSQL through node-postgres. Planned frontend: React, Vite, React Hook Form, Tailwind CSS. Jobs are records with manually controlled statuses; this application does not execute tasks. Duplicate titles are allowed and type is free text.

## Local backend setup (PowerShell)

Use Node 22.12+ on the 22.x line (development machine: 22.19.0).

```powershell
cd airth-job-dashboard/backend
npm ci
Copy-Item .env.example .env # First setup only; never overwrite a configured .env.
```

Set `DATABASE_URL` in `.env` to a dedicated Neon database connection string, retaining the provider's TLS parameters. Never commit credentials. Set `FRONTEND_ORIGIN` to the allowed frontend origin.

```powershell
npm run migrate
npm run build
npm start
```

For development use `npm run dev`. The API listens on port 3000 by default.

## Implemented API

| Endpoint | Request | Success |
| --- | --- | --- |
| POST /jobs | JSON with title and type | 201, created job |
| GET /jobs | No body | 200, array ordered newest first |

```powershell
Invoke-RestMethod http://localhost:3000/jobs -Method Post -ContentType 'application/json' -Body '{"title":"Sales report","type":"report"}'
Invoke-RestMethod http://localhost:3000/jobs
```

Jobs contain `id`, `title`, `type`, `status`, and ISO `createdAt`. The backend generates UUIDs. PostgreSQL supplies initial `pending` status and creation time. Title is trimmed to 1–120 characters; type to 1–50. Invalid, missing, non-string, blank, or unexpected fields return 400. SQL uses parameters instead of interpolating client values. Database constraints also protect stored values.

## Tests and verification boundaries

```powershell
npm test
```

These HTTP tests use the real NestJS routing, pipe, controller and service with a mock database. They verify the request contract, not PostgreSQL persistence.

For integration tests, set `TEST_DATABASE_URL` to a separate test database. Each run creates and removes its own random schema. It never truncates the application's jobs table. The test role needs schema creation permission.

```powershell
npm run test:integration
```

The suite intentionally fails if configuration is missing. A written integration test is not evidence that a live database has been tested.

## Decisions and remaining work

- Controllers handle HTTP; DTO decorators validate input; the service runs application queries; dependency injection supplies one shared database pool.
- Versioned migrations run explicitly and record applied files transactionally. Startup never drops or recreates tables.
- The pool has connection timeouts and closes on graceful shutdown.
- NestJS 11 is pinned for this small CommonJS/TypeScript teaching setup. Its transitive Multer dependency is overridden to patched 2.3.0; no upload routes are exposed. Recheck this override when upgrading NestJS.
- Next: conditional SQL transitions (`pending → running → completed/failed`) that remain correct for simultaneous requests; deletion; React dashboard; frontend and concurrency tests.
- Production-readiness bonus, public repository and deployment URLs are still pending. This README does not claim a complete submission.
