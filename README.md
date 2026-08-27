# Memo Manager

A multi-tenant Inter-Office Memo Management System — memo creation, sequential
review/approval workflows, and full audit history, with strict isolation
between organizations. Built for CSE226.1 Project 3.

See [`docs/PROJECT_DOCUMENTATION.md`](docs/PROJECT_DOCUMENTATION.md) for
architecture, database design, and security notes, and
[`SUBMISSION.md`](SUBMISSION.md) for the deployed URL and demo credentials.

## 1. Required software and versions

- **Node.js 22 or later** (`node --version`)
- **npm 10 or later** (ships with Node 22)
- **Docker** (for a local Postgres instance) — or a [Neon](https://neon.tech)
  Postgres connection string if you'd rather not run Docker locally
- **git**

No other external service is required. There is no outbound email in this
deployment — see §9 below and `docs/PROJECT_DOCUMENTATION.md`'s "Known
limitations" section.

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment variables

Copy the template and fill in your database URL:

```bash
cp .env.example .env.local
```

`.env.local` (gitignored) is read by Next.js, drizzle-kit, the seed script,
and the test suite. Variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. For Neon, use the **pooled** connection string (contains `-pooler`). |
| `TEST_DATABASE_URL` | A separate database the test suite truncates freely — never point this at data you care about. |
| `SEED_PASSWORD` | Password assigned to every demo account created by `npm run seed`. Defaults to `Password123!` if unset. |

## 4. Configure the database

**Option A — local Docker Postgres (default, matches `.env.example`):**

```bash
docker compose up -d
```

This starts Postgres 16 on `localhost:5433`, credentials `memo`/`memo`,
database `memo`.

**Option B — Neon (or any hosted Postgres):** create a database and set
`DATABASE_URL` in `.env.local` to its connection string instead. No other
change is needed.

Then create the dedicated test database (used only by `npm test`):

```bash
docker exec memo-postgres psql -U memo -d memo -c "CREATE DATABASE memo_test"
```

(For a hosted database, create `memo_test` the same way through your
provider's SQL console or CLI, or point `TEST_DATABASE_URL` at a second
database you create for it.)

## 5. Initialize the database

Apply the committed migrations (schema lives in `db/schema.ts`, generated SQL
in `db/migrations/`):

```bash
npm run db:migrate
```

## 6. Create demonstration data

```bash
npm run seed
```

This **truncates every table** and rebuilds two independent demo
organizations — Northbridge University and Aurora Logistics — with
departments, categories, workflow templates, users, and memos in every
lifecycle status (draft, pending review/approval, changes requested,
rejected, approved, cancelled). It prints every seeded account's email and
role; the password for all of them is `SEED_PASSWORD` from your `.env.local`
(default `Password123!`). See [`SUBMISSION.md`](SUBMISSION.md) for the exact
credential list and a walkthrough script.

Re-run it any time to reset to a clean demo state.

## 7. Start the application locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll land on the
sign-in page; use a seeded account, or register a brand-new organization at
`/register-organization`.

## 8. Build for production

```bash
npm run build
npm run start
```

`npm run build` runs Next.js's production build (Turbopack) plus a
TypeScript check; `npm run start` serves the built app.

## 9. External services

None. Passwords are hashed with bcrypt; sessions are database-backed. There
is no outbound email — password reset issues a single-use link that is
logged to the server console and can also be generated on demand by an
organization administrator from **Admin → Users → Reset link**.

## 10. Reproducing the deployed environment

The deployed instance (see `SUBMISSION.md` for the URL) is Vercel + Neon with
no additional configuration beyond `DATABASE_URL` set to Neon's **pooled**
connection string. To reproduce it:

1. Push this repository to GitHub.
2. Create a [Neon](https://neon.tech) project, copy its pooled connection
   string, and run `npm run db:migrate` and `npm run seed` against it locally
   (steps 5–6 above, with `DATABASE_URL` pointed at Neon).
3. Import the repository at [vercel.com/new](https://vercel.com/new) and set
   one environment variable: `DATABASE_URL` = the same Neon pooled string.
   Vercel builds with `npm run build` and serves over HTTPS automatically.

No other environment variable is required in production; `SEED_PASSWORD` and
`TEST_DATABASE_URL` matter only for local development.

## Other commands

```bash
npm run db:generate   # generate a new migration after changing db/schema.ts
npm run db:studio     # drizzle-kit's local database browser
npm test              # run the Vitest suite against TEST_DATABASE_URL
npm run lint          # ESLint
```

## Project structure

```
app/(auth)/     login, organization registration, password reset
app/(app)/      dashboard, inbox, memos, search, notifications, profile, delegations
app/(admin)/    organization administration: users, departments, categories,
                workflow templates, reports, audit log
app/api/        authorized attachment/logo/PDF download routes
lib/            auth, tenant scoping, authorization, the workflow engine, PDF export
lib/repo/       tenant-scoped read queries, one file per aggregate
db/             Drizzle schema, migrations, seed script
components/     design system primitives and memo/dashboard components
tests/          Vitest suite, including the full tenant-isolation test file
docs/           design spec, implementation plan, project documentation
```
