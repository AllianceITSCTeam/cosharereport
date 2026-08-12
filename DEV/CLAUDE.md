# CoShareReport

A standalone reporting site for the CoShare project. Reused technical scaffold from Vibe365Dev (NestJS 10 + Prisma + PostgreSQL backend, React 18 + Vite frontend, pnpm monorepo, Railway deploy) — all Vibe365 business logic has been stripped out.

## What this app is

- Accessed via a single link CoShare sends users, carrying an access token in the URL — one-way SSO, no login form.
- Connects **directly and read-only** to CoShare's existing PostgreSQL database via a dedicated readonly Postgres role. This app never writes to that database.
- Everything past authentication (report logic, UI, deploy) is owned by this app; it does not call back into any CoShare API.

## Architecture

- `apps/api` — NestJS 10 backend.
  - `auth/` — two ways in, both ending in this app's own session JWT (`SESSION_JWT_SECRET`) in an httpOnly cookie:
    - `POST /api/auth/login` (BFF login) — takes a CoShare username/password, proxies them to CoShare's OAuth2 password-grant endpoint (`COSHARE_OAUTH_TOKEN_URL`) server-side, decodes the returned token, mints our session cookie. This is the working path today (login form at `/login`). Rate-limited via the `sso` throttle bucket.
    - `GET /sso?token=...` (auto-SSO, future) — verifies a CoShare-issued JWT (`COSHARE_JWT_SECRET`, HS256 assumed) and mints the same cookie. **Blocked on CoShare** (we can't verify their signature yet) — what they must implement is in `docs/requirements/sso-integration/`. Invalid/missing token redirects to `/auth-error`.
    - `DISABLE_AUTH=true` bypasses all of the above with a dev user — **dev only, must be `false`/unset in production** or every report is public.
  - `prisma/prisma.service.ts` — Prisma client with a middleware that blocks all write actions (`create`/`update`/`delete`/`upsert`/`executeRaw*`) at the application layer, defense-in-depth on top of the DB-level readonly role.
  - `reports/` — one Prisma-backed readonly endpoint per report. `reports.controller.ts`/`reports.service.ts` currently only has a `ping()` health-check placeholder — see "Adding a report" below.
  - Global response envelope (`ResponseInterceptor`) wraps all responses as `{ success, data, durationMs }`; `HttpExceptionFilter` wraps errors as `{ success: false, message, code?, errors? }` and serves `index.html` for non-API 404s (SPA fallback).
  - `app.setGlobalPrefix('api', { exclude: ['sso'] })` — every route is under `/api/*` except the external `/sso` entry point.
- `apps/web` — React 18 + Vite frontend.
  - `stores/auth.store.ts` — minimal zustand store holding the current user (`sub`, `name?`, `email?`, `role?` — matches the backend's `SessionPayload`).
  - `lib/auth-init.ts` — calls `GET /auth/me` once on load to populate the store.
  - `routes/index.tsx` — `/` (protected dashboard), `/auth-error` (public), catch-all 404. No `/login` route exists.
  - `components/ProtectedRoute.tsx` — shows an informational message (not a redirect) when there's no session, since there's nowhere to redirect to.
- `packages/shared` — shared types only (`ApiResponse<T>` envelope). No Vibe365-specific enums/constants.
- `apps/api/prisma/schema.prisma` — **already introspected** from CoShare's live database (~504 models). Refresh with `prisma db pull` when their schema changes (never `migrate` — see Database below).

## Database

The target database is CoShare's existing production/staging schema, not one this app owns or migrates.

**HARD RULES — the connection string is READONLY. This app (and Claude) can only READ.**

- **Never write anything to the database** — no `create`/`update`/`delete`/`upsert`/`$executeRaw*`, no `prisma migrate`, no `CREATE`/`ALTER`/`DROP`/`INSERT`/`UPDATE`/`DELETE`. Every query must be readonly (`findMany`/`findUnique`/`aggregate`/`count`/`$queryRaw`). The Prisma middleware in `prisma.service.ts` throws on writes as a backstop — but don't rely on it, just don't write.
- **Need a DB view or function?** Claude does NOT create it (no permission). Write the SQL, save it under `sql-scripts/` (naming below), and **hand the task to a HUMAN** to run it — state clearly what to run and why.
- **`sql-scripts/` folder** — every SQL script (view/function definitions, reconciliation queries, ad-hoc checks) is saved here so there's a trail. Filename format: `yyyy-MM-dd HH:mm <short description>.sql`. See `sql-scripts/README.md`.
- To pick up schema changes: `cd apps/api && npx prisma db pull && npx prisma generate` (introspection only — reads, never writes).

## Adding a report

Full workflow + verification checklist: `docs/reports/_TEMPLATE.md`. Business definitions
(timezone, soft-delete, status enums, metric formulas) live in `docs/db/`. Curated table docs:
`docs/db/table-dictionary.md`. Raw backend docs (from `ck:doc`): `docs/coshare-backend/`.

Code pattern — follow `apps/api/src/reports/` (`latestUsers` is a working end-to-end example):
1. **Write the test first** (see TDD rule below) — the first test for a report is a *number
   reconciliation* (invariant + golden), not "does it return rows".
2. Add a method to `reports.service.ts` doing one readonly Prisma query (or a small set of them).
3. Add a `@Get('...')` handler to `reports.controller.ts` (already behind `JwtAuthGuard`).
4. Add a matching function to `apps/web/src/api/reports.api.ts` and a page/component under `apps/web/src/pages/` + `apps/web/src/routes/index.tsx`.
5. **Verify the numbers**, not just that it runs — reconcile against a known slice / CoShare golden numbers (`docs/reports/_TEMPLATE.md` §6).

## Testing — TDD is mandatory

This project runs **TDD: red → green → refactor.** Write the failing test **before** the code.
The biggest risk here is *numbers that are wrong but look plausible*, so tests are the spec.

- **Reports:** the first test is a **number-reconciliation** test — an *invariant* (sum of groups
  = grand total; no JOIN fan-out) and/or a *golden number* — written before the query. See
  `standards/08-verification.md` for what to reconcile, `principles/testing.md` for how to write it.
- **Two tiers:** *Unit* tests **mock Prisma** (deterministic, run in CI) — never hit the real DB
  in CI. A separate *reconciliation* suite hits the live DB (invariants + golden), opt-in via
  `RECON_DB=1`, and is **not** a CI gate (prod data drifts).
- **Golden numbers** live in one place (`docs/db/conventions.md §5` + the report's spec), mirrored
  into a single test fixture with a `snapshotDate` — never hardcoded ad-hoc across tests.
- A `*.service.ts` without a `*.service.spec.ts` must not merge — warn the HUMAN first.

## Open questions with the CoShare team (not yet answered)

These block finishing the auth module and the real report list — see `apps/api/src/auth/auth.types.ts` for where the placeholder claims live:
1. Token format: JWT or opaque? If JWT, signing algorithm (HS256 shared secret assumed — confirm)?
2. Exact claim names in the token (currently assumed: `sub`, `name`, `email`, `role`).
3. Token transport (query param vs header) and whether it's single-use / has a short TTL.
4. The concrete list of reports needed (source tables, filters, who sees what).

## Environment

See `.env.example`. Key vars: `DATABASE_URL` (readonly role), `COSHARE_JWT_SECRET`, `SESSION_JWT_SECRET`, `SSO_REDIRECT_PATH`.

## Conventions

See `principles/` (coding, api, architecture, security, git, testing, ui-ux) — carried over from Vibe365Dev. Ignore any rule that's clearly about Vibe365-specific concepts (e.g. soft-delete `Log_*` columns, role lists) unless CoShare's schema happens to use the same convention.
