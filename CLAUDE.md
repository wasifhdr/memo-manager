# Memo Manager

Multi-tenant Inter-Office Memo Management System — see [Project_3_PRD.md](../Project_3_PRD.md) for the assignment spec.

## Read first

- **[docs/superpowers/specs/2026-08-27-memo-management-design.md](docs/superpowers/specs/2026-08-27-memo-management-design.md)** — the design: architecture, data model, workflow engine, security mapping.
- **[docs/superpowers/plans/2026-08-27-memo-management-system.md](docs/superpowers/plans/2026-08-27-memo-management-system.md)** — phased implementation plan, one task per session slice.

## Stack

Next.js (App Router, TypeScript) · Tailwind CSS v4 (CSS-first, no `tailwind.config.js`) · Drizzle ORM + postgres-js over Neon Postgres · bcryptjs sessions (no NextAuth) · Zod · Tiptap · sanitize-html · pdf-lib · Vitest.

## Commands

```bash
docker compose up -d          # local postgres
npm run db:generate           # generate a migration from db/schema.ts
npm run db:migrate            # apply migrations
npm run seed                  # demo data (two organizations)
npm run dev                   # dev server
npm test                      # vitest against TEST_DATABASE_URL
```

## Hard rules

- Every route/Server Action runs on the **Node** runtime — never `edge`.
- No repository function may accept a caller-supplied `orgId`. Every one takes `ctx: TenantContext` (from `lib/tenant.ts`) as its first argument, built only from a verified session.
- A row in another organization returns **not-found**, never 403.
- `memo_events` is append-only — no `UPDATE`/`DELETE` against it, ever.
- Every workflow mutation runs inside `db.transaction` with `SELECT … FOR UPDATE` on the memo row.
