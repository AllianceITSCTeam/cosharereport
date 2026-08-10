# CoShareReport

A standalone reporting site for the CoShare project. Reused technical scaffold from Vibe365Dev (NestJS 10 + Prisma + PostgreSQL backend, React 18 + Vite frontend, pnpm monorepo, Railway deploy) — all Vibe365 business logic has been stripped out.

## What this app is

- Accessed via a single link CoShare sends users, carrying an access token in the URL — one-way SSO, no login form.
- Connects **directly and read-only** to CoShare's existing PostgreSQL database via a dedicated readonly Postgres role. This app never writes to that database.
- Everything past authentication (report logic, UI, deploy) is owned by this app; it does not call back into any CoShare API.

## Architecture

- `apps/api` — NestJS 10 backend.
  - `auth/` — verifies the CoShare-issued JWT (`COSHARE_JWT_SECRET`, HS256 assumed) at `GET /sso?token=...`, then mints this app's own session JWT (`SESSION_JWT_SECRET`) stored in an httpOnly cookie. Invalid/missing token redirects to `/auth-error`.
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
- `prisma/schema.prisma` — currently a placeholder (datasource + generator only). The real models come from introspecting CoShare's live database — see below.

## Database

The target database is CoShare's existing production/staging schema, not one this app owns or migrates.

- Never run `prisma migrate` against `DATABASE_URL` — this app has a readonly role and shouldn't be changing CoShare's schema even if it could.
- To pick up schema changes: `cd apps/api && npx prisma db pull && npx prisma generate`.
- Every new Prisma query must be readonly (`findMany`/`findUnique`/`aggregate`/`count`/`$queryRaw` — never `create`/`update`/`delete`/`$executeRaw*`). The Prisma middleware in `prisma.service.ts` throws on writes as a backstop, but don't rely on it — just don't write.

## Adding a report

Follow the pattern in `apps/api/src/reports/`:
1. Add a method to `reports.service.ts` doing one readonly Prisma query (or a small set of them).
2. Add a `@Get('...')` handler to `reports.controller.ts` (already behind `JwtAuthGuard`).
3. Add a matching function to `apps/web/src/api/reports.api.ts` and a page/component under `apps/web/src/pages/` + `apps/web/src/routes/index.tsx`.

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
