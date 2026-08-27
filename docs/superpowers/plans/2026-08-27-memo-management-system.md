# Inter-Office Memo Management System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a multi-tenant Inter-Office Memo Management System satisfying §1–§29 of `docs/superpowers/specs/2026-08-27-memo-management-design.md`.

**Architecture:** One Next.js 15 App Router project on Vercel with Neon Postgres. Reads are server components calling repository functions that require a `TenantContext`; writes are Server Actions. The workflow engine is a single module whose every action runs in a transaction opened with `SELECT … FOR UPDATE` on the memo row.

**Tech Stack:** Next.js 15 · TypeScript · Tailwind CSS v4 · Drizzle ORM · postgres-js · Neon Postgres · bcryptjs · Zod · Tiptap · sanitize-html · pdf-lib · Vitest.

## Global Constraints

- Node 22+; the repo's toolchain is npm (`package-lock.json` committed).
- Every route and Server Action runs on the **Node runtime**. Never add `export const runtime = 'edge'`.
- Tailwind CSS **v4**, CSS-first: `@import "tailwindcss";` plus `@tailwindcss/vite`-equivalent PostCSS plugin. There is **no `tailwind.config.js`**. Do not scaffold v3-style.
- **No query may accept a caller-supplied `orgId`.** Every repository function takes `ctx: TenantContext` as its first parameter and every `WHERE` includes `org_id = ctx.orgId`.
- A tenant-owned row that does not belong to the caller's org yields **404 / not-found**, never 403.
- `memo_events` is append-only. No code path may `UPDATE` or `DELETE` it.
- Every Server Action validates its input with a Zod schema before touching the database.
- Timestamps are `timestamptz`, stored UTC. Money/dates never use local time.
- Passwords: bcryptjs, cost 12. Session and reset tokens are stored **hashed** (SHA-256), never raw.
- Attachment limits: 4 MB per file, 10 files per memo, MIME+extension allowlist.
- Roles are exactly `org_admin` and `user`. Statuses are exactly `draft`, `submitted`, `pending_review`, `pending_approval`, `changes_requested`, `rejected`, `approved`, `cancelled`.
- Priorities are exactly `normal`, `high`, `urgent`.
- Commit after every task. Message style: `feat: …`, `fix: …`, `docs: …`, `test: …`.

## File Structure

| File | Responsibility |
|---|---|
| `db/schema.ts` | All Drizzle table definitions and enums. Single source of truth for types. |
| `db/migrations/*.sql` | drizzle-kit output, committed. |
| `db/seed.ts` | Two demo organizations with full data. |
| `lib/db.ts` | `db` client, `Executor` type, connection config. |
| `lib/auth.ts` | Password hashing, session lifecycle, reset tokens. No HTTP awareness. |
| `lib/tenant.ts` | `TenantContext` construction from the request cookie. The only source of org scope. |
| `lib/authz.ts` | Memo-level access decisions and delegation resolution. |
| `lib/workflow.ts` | The workflow state machine. |
| `lib/notify.ts` | Notification fan-out. |
| `lib/audit.ts` | Audit log append. |
| `lib/memo-number.ts` | Race-safe per-org memo numbering. |
| `lib/sanitize.ts` | HTML allowlist for memo bodies. |
| `lib/pdf.ts` | Memo → PDF bytes. |
| `lib/repo/*.ts` | Tenant-scoped read queries, one file per aggregate. |
| `app/**/actions.ts` | Server Actions, colocated with the pages that use them. |
| `components/ui/*` | Design system primitives from the impeccable pass. |
| `components/memo/*` | `WorkflowRail`, `Timeline`, `MemoCard`, `StatusBadge`, `ActionPanel`, `Editor`. |
| `tests/*` | Vitest suites against a Docker Postgres. |

---

### Task 1: Scaffold, database schema and migrations

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `drizzle.config.ts`, `.env.example`, `docker-compose.yml`
- Create: `lib/db.ts`, `db/schema.ts`
- Create: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Test: `tests/helpers/db.ts`, `tests/schema.test.ts`

**Interfaces:**
- Produces: `db` (Drizzle client), `type Executor`, and every table object exported from `db/schema.ts` — `organizations`, `departments`, `users`, `sessions`, `passwordResetTokens`, `memoCategories`, `workflowTemplates`, `workflowTemplateSteps`, `memos`, `memoVersions`, `memoAttachments`, `workflowSteps`, `memoEvents`, `notifications`, `auditLog`, `delegations`, `memoCounters` — plus the exported enum arrays `ROLES`, `USER_STATUSES`, `PRIORITIES`, `MEMO_STATUSES`, `STEP_OUTCOMES`, `REQUIRED_ACTIONS`, `EVENT_TYPES`, `NOTIFICATION_TYPES`, `DELEGATION_STATUSES`.

- [ ] **Step 1: Scaffold the Next.js project in place**

Run in the project root (the directory already contains `.git` and `docs/`):

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --use-npm --eslint --turbopack
```

Accept overwriting nothing outside the generated files. Then verify Tailwind v4:

```bash
node -e "console.log(require('./package.json').dependencies.tailwindcss)"
```

Expected: a `^4.x` version. If a `tailwind.config.ts` or `tailwind.config.js` was generated, delete it — v4 is CSS-first.

- [ ] **Step 2: Install runtime and dev dependencies**

```bash
npm i drizzle-orm postgres bcryptjs zod sanitize-html pdf-lib @tiptap/react @tiptap/starter-kit @tiptap/pm date-fns
npm i -D drizzle-kit @types/bcryptjs @types/sanitize-html vitest dotenv tsx
```

- [ ] **Step 3: Add the local Postgres service**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: memo-postgres
    environment:
      POSTGRES_USER: memo
      POSTGRES_PASSWORD: memo
      POSTGRES_DB: memo
    ports:
      - "5433:5432"
    volumes:
      - memo-pgdata:/var/lib/postgresql/data
volumes:
  memo-pgdata:
```

Create `.env.example`:

```
# Postgres connection string. Local docker default shown; in production use the
# Neon POOLED connection string (the one containing "-pooler").
DATABASE_URL=postgresql://memo:memo@localhost:5433/memo

# Separate database used by the test suite. Created by `npm run db:test:setup`.
TEST_DATABASE_URL=postgresql://memo:memo@localhost:5433/memo_test
```

Copy it to `.env.local` (gitignored) with the same values, then:

```bash
docker compose up -d
docker exec memo-postgres psql -U memo -d memo -c "CREATE DATABASE memo_test"
```

Expected: `CREATE DATABASE`.

- [ ] **Step 4: Write the database client**

Create `lib/db.ts`:

```ts
import { drizzle, type PostgresJsDatabase, type PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import postgres from 'postgres'
import * as schema from '@/db/schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')

// `prepare: false` is required behind Neon's pooler (PgBouncer transaction mode).
const client = postgres(connectionString, { prepare: false, max: 5 })

export const db = drizzle(client, { schema })

export type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>

/** Anything that can run a query: the pool, or an open transaction. */
export type Executor = PostgresJsDatabase<typeof schema> | Tx
```

- [ ] **Step 5: Write the schema**

Create `db/schema.ts`. Enums are stored as text with a check constraint (`{ enum: [...] }` in Drizzle) rather than native PG enums, so adding a value never needs a migration dance.

```ts
import {
  pgTable, uuid, text, timestamp, integer, boolean, jsonb, customType,
  uniqueIndex, index, primaryKey,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const ROLES = ['org_admin', 'user'] as const
export const USER_STATUSES = ['active', 'inactive'] as const
export const PRIORITIES = ['normal', 'high', 'urgent'] as const
export const MEMO_STATUSES = [
  'draft', 'submitted', 'pending_review', 'pending_approval',
  'changes_requested', 'rejected', 'approved', 'cancelled',
] as const
export const REQUIRED_ACTIONS = ['approve', 'review'] as const
export const STEP_OUTCOMES = [
  'pending', 'approved', 'reviewed', 'rejected', 'changes_requested', 'skipped',
] as const
export const EVENT_TYPES = [
  'created', 'submitted', 'resubmitted', 'approved', 'reviewed', 'rejected',
  'changes_requested', 'comment', 'forwarded', 'completed', 'cancelled',
  'attachment_added', 'attachment_deleted', 'version_created',
  'participant_assigned', 'edited',
] as const
export const NOTIFICATION_TYPES = [
  'action_required', 'approved', 'rejected', 'changes_requested',
  'comment_added', 'resubmitted', 'workflow_completed', 'workflow_assigned',
] as const
export const DELEGATION_STATUSES = ['active', 'revoked', 'expired'] as const

export type Role = (typeof ROLES)[number]
export type UserStatus = (typeof USER_STATUSES)[number]
export type Priority = (typeof PRIORITIES)[number]
export type MemoStatus = (typeof MEMO_STATUSES)[number]
export type RequiredAction = (typeof REQUIRED_ACTIONS)[number]
export type StepOutcome = (typeof STEP_OUTCOMES)[number]
export type EventType = (typeof EVENT_TYPES)[number]
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
})

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  code: text('code').notNull(),
  logo: bytea('logo'),
  logoMime: text('logo_mime'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  address: text('address'),
  config: jsonb('config').$type<{ memoPrefix: string }>().notNull().default({ memoPrefix: 'MEMO' }),
  createdAt: createdAt(),
})

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index('departments_org_idx').on(t.orgId)])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  email: text('email').notNull(),
  designation: text('designation'),
  departmentId: uuid('department_id').references(() => departments.id),
  role: text('role', { enum: ROLES }).notNull().default('user'),
  status: text('status', { enum: USER_STATUSES }).notNull().default('active'),
  passwordHash: text('password_hash').notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('users_org_email_idx').on(t.orgId, t.email),
  index('users_org_idx').on(t.orgId),
])

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [index('sessions_user_idx').on(t.userId)])

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: createdAt(),
})

export const memoCategories = pgTable('memo_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index('categories_org_idx').on(t.orgId)])

export const workflowTemplates = pgTable('workflow_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index('templates_org_idx').on(t.orgId)])

export const workflowTemplateSteps = pgTable('workflow_template_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  templateId: uuid('template_id').notNull().references(() => workflowTemplates.id, { onDelete: 'cascade' }),
  stepNo: integer('step_no').notNull(),
  positionTitle: text('position_title').notNull(),
  requiredAction: text('required_action', { enum: REQUIRED_ACTIONS }).notNull().default('approve'),
}, (t) => [uniqueIndex('template_step_idx').on(t.templateId, t.stepNo)])

export const memoCounters = pgTable('memo_counters', {
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  year: integer('year').notNull(),
  seq: integer('seq').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.orgId, t.year] })])

export const memos = pgTable('memos', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  memoNumber: text('memo_number').notNull(),
  subject: text('subject').notNull(),
  bodyHtml: text('body_html').notNull().default(''),
  authorId: uuid('author_id').notNull().references(() => users.id),
  departmentId: uuid('department_id').references(() => departments.id),
  categoryId: uuid('category_id').references(() => memoCategories.id),
  priority: text('priority', { enum: PRIORITIES }).notNull().default('normal'),
  status: text('status', { enum: MEMO_STATUSES }).notNull().default('draft'),
  templateId: uuid('template_id').references(() => workflowTemplates.id),
  currentCycle: integer('current_cycle').notNull().default(0),
  currentStepNo: integer('current_step_no'),
  currentVersion: integer('current_version').notNull().default(0),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  finalApproverId: uuid('final_approver_id').references(() => users.id),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('memos_org_number_idx').on(t.orgId, t.memoNumber),
  index('memos_org_status_idx').on(t.orgId, t.status),
  index('memos_org_author_idx').on(t.orgId, t.authorId),
  index('memos_search_idx').using(
    'gin',
    sql`to_tsvector('english', ${t.subject} || ' ' || ${t.bodyHtml})`,
  ),
])

export const memoVersions = pgTable('memo_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  memoId: uuid('memo_id').notNull().references(() => memos.id, { onDelete: 'cascade' }),
  versionNo: integer('version_no').notNull(),
  subject: text('subject').notNull(),
  bodyHtml: text('body_html').notNull(),
  editorId: uuid('editor_id').notNull().references(() => users.id),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('memo_version_idx').on(t.memoId, t.versionNo)])

export const memoAttachments = pgTable('memo_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  memoId: uuid('memo_id').notNull().references(() => memos.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mime: text('mime').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  data: bytea('data').notNull(),
  uploadedById: uuid('uploaded_by_id').notNull().references(() => users.id),
  versionNo: integer('version_no').notNull().default(1),
  createdAt: createdAt(),
}, (t) => [index('attachments_memo_idx').on(t.memoId)])

export const workflowSteps = pgTable('workflow_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  memoId: uuid('memo_id').notNull().references(() => memos.id, { onDelete: 'cascade' }),
  cycle: integer('cycle').notNull(),
  stepNo: integer('step_no').notNull(),
  positionTitle: text('position_title'),
  assigneeUserId: uuid('assignee_user_id').notNull().references(() => users.id),
  requiredAction: text('required_action', { enum: REQUIRED_ACTIONS }).notNull().default('approve'),
  outcome: text('outcome', { enum: STEP_OUTCOMES }).notNull().default('pending'),
  actedByUserId: uuid('acted_by_user_id').references(() => users.id),
  onBehalfOfUserId: uuid('on_behalf_of_user_id').references(() => users.id),
  actedAt: timestamp('acted_at', { withTimezone: true }),
  comment: text('comment'),
}, (t) => [
  uniqueIndex('workflow_step_idx').on(t.memoId, t.cycle, t.stepNo),
  index('workflow_assignee_idx').on(t.assigneeUserId, t.outcome),
])

export const memoEvents = pgTable('memo_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  memoId: uuid('memo_id').notNull().references(() => memos.id, { onDelete: 'cascade' }),
  type: text('type', { enum: EVENT_TYPES }).notNull(),
  actorId: uuid('actor_id').references(() => users.id),
  onBehalfOfId: uuid('on_behalf_of_id').references(() => users.id),
  cycle: integer('cycle'),
  stepNo: integer('step_no'),
  comment: text('comment'),
  detail: text('detail'),
  createdAt: createdAt(),
}, (t) => [index('events_memo_idx').on(t.memoId, t.createdAt)])

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: NOTIFICATION_TYPES }).notNull(),
  memoId: uuid('memo_id').references(() => memos.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index('notifications_user_idx').on(t.userId, t.readAt)])

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id),
  actorId: uuid('actor_id').references(() => users.id),
  eventType: text('event_type').notNull(),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  description: text('description').notNull(),
  ip: text('ip'),
  createdAt: createdAt(),
}, (t) => [index('audit_org_idx').on(t.orgId, t.createdAt)])

export const delegations = pgTable('delegations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  delegatorId: uuid('delegator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  delegateId: uuid('delegate_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  reason: text('reason'),
  status: text('status', { enum: DELEGATION_STATUSES }).notNull().default('active'),
  createdAt: createdAt(),
}, (t) => [index('delegations_delegate_idx').on(t.delegateId, t.status)])
```

- [ ] **Step 6: Configure drizzle-kit and generate the migration**

Create `drizzle.config.ts`:

```ts
import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
```

Add to `package.json` scripts:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:studio": "drizzle-kit studio",
"seed": "tsx db/seed.ts",
"test": "vitest run",
"test:watch": "vitest"
```

Run:

```bash
npm run db:generate && npm run db:migrate
```

Expected: a file appears under `db/migrations/`, and the migration applies without error.

- [ ] **Step 7: Write the test harness**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/helpers/setup.ts'],
    fileParallelism: false,
    testTimeout: 30000,
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
```

Create `tests/helpers/setup.ts`:

```ts
import 'dotenv/config'

// Every test file talks to the dedicated test database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!
if (!process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set')
```

Create `tests/helpers/db.ts`:

```ts
import { execSync } from 'node:child_process'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

let migrated = false

/** Applies migrations once per test run, then truncates every table. */
export async function resetDb() {
  if (!migrated) {
    execSync('npx drizzle-kit migrate', {
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL! },
      stdio: 'ignore',
    })
    migrated = true
  }
  await db.execute(sql`
    DO $$
    DECLARE t text;
    BEGIN
      FOR t IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '__drizzle_migrations'
      LOOP
        EXECUTE format('TRUNCATE TABLE %I CASCADE', t);
      END LOOP;
    END $$;
  `)
}
```

- [ ] **Step 8: Write the failing schema test**

Create `tests/schema.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { resetDb } from './helpers/db'
import { db } from '@/lib/db'
import { organizations, departments, users } from '@/db/schema'
import { eq } from 'drizzle-orm'

describe('schema', () => {
  beforeAll(async () => { await resetDb() })

  it('stores an organization with a department and a user', async () => {
    const [org] = await db.insert(organizations)
      .values({ name: 'Northbridge University', slug: 'northbridge', code: 'NBU' })
      .returning()

    const [dept] = await db.insert(departments)
      .values({ orgId: org.id, name: 'Finance' }).returning()

    const [user] = await db.insert(users).values({
      orgId: org.id, name: 'Ayesha Rahman', email: 'ayesha@nbu.test',
      departmentId: dept.id, role: 'org_admin', passwordHash: 'x',
    }).returning()

    expect(user.orgId).toBe(org.id)
    expect(user.status).toBe('active')
    expect(org.config.memoPrefix).toBe('MEMO')

    const found = await db.select().from(users).where(eq(users.orgId, org.id))
    expect(found).toHaveLength(1)
  })

  it('rejects a duplicate email inside one organization', async () => {
    const [org] = await db.insert(organizations)
      .values({ name: 'Aurora Logistics', slug: 'aurora', code: 'AUR' }).returning()
    const row = { orgId: org.id, name: 'A', email: 'dup@aurora.test', passwordHash: 'x' }
    await db.insert(users).values(row)
    await expect(db.insert(users).values(row)).rejects.toThrow()
  })
})
```

- [ ] **Step 9: Run the test**

```bash
npm test -- tests/schema.test.ts
```

Expected: PASS, 2 tests. If the migration step fails, confirm `TEST_DATABASE_URL` points at `memo_test` and that the container is running.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold next.js app, database schema and migrations"
```

---

### Task 2: Authentication core and tenant context

**Files:**
- Create: `lib/auth.ts`, `lib/tenant.ts`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `db`, `Executor`, `users`, `sessions`, `passwordResetTokens` from Task 1.
- Produces:
  - `hashPassword(plain: string): Promise<string>`
  - `verifyPassword(plain: string, hash: string): Promise<boolean>`
  - `hashToken(raw: string): string`
  - `createSession(userId: string, userAgent?: string | null): Promise<string>` — returns the **raw** token
  - `resolveSession(rawToken: string): Promise<SessionUser | null>`
  - `destroySession(rawToken: string): Promise<void>`
  - `revokeUserSessions(userId: string, ex?: Executor): Promise<void>`
  - `createPasswordResetToken(userId: string): Promise<string>` — returns the raw token
  - `consumePasswordResetToken(rawToken: string): Promise<string | null>` — returns the user id
  - `type SessionUser = { id, orgId, name, email, role, status, departmentId, designation }`
  - `type TenantContext = { orgId: string; user: SessionUser }`
  - `getSession(): Promise<TenantContext | null>`, `requireSession(): Promise<TenantContext>`, `requireAdmin(): Promise<TenantContext>`
  - `SESSION_COOKIE = 'memo_session'`, `setSessionCookie(raw: string)`, `clearSessionCookie()`

- [ ] **Step 1: Write the failing test**

Create `tests/auth.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { resetDb } from './helpers/db'
import { db } from '@/lib/db'
import { organizations, users, sessions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import {
  hashPassword, verifyPassword, createSession, resolveSession, destroySession,
  revokeUserSessions, createPasswordResetToken, consumePasswordResetToken, hashToken,
} from '@/lib/auth'

let userId: string
let orgId: string

beforeAll(async () => {
  await resetDb()
  const [org] = await db.insert(organizations)
    .values({ name: 'NBU', slug: 'nbu', code: 'NBU' }).returning()
  orgId = org.id
  const [u] = await db.insert(users).values({
    orgId, name: 'Ayesha', email: 'a@nbu.test',
    passwordHash: await hashPassword('correct horse'),
  }).returning()
  userId = u.id
})

describe('passwords', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('s3cret')
    expect(hash).not.toContain('s3cret')
    expect(await verifyPassword('s3cret', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })
})

describe('sessions', () => {
  it('stores only a hash of the token', async () => {
    const raw = await createSession(userId)
    const rows = await db.select().from(sessions).where(eq(sessions.userId, userId))
    expect(rows.some((r) => r.tokenHash === raw)).toBe(false)
    expect(rows.some((r) => r.tokenHash === hashToken(raw))).toBe(true)
  })

  it('resolves a valid token to the user with their org', async () => {
    const raw = await createSession(userId)
    const su = await resolveSession(raw)
    expect(su?.id).toBe(userId)
    expect(su?.orgId).toBe(orgId)
  })

  it('returns null for an unknown token', async () => {
    expect(await resolveSession('not-a-real-token')).toBeNull()
  })

  it('returns null after the session is destroyed', async () => {
    const raw = await createSession(userId)
    await destroySession(raw)
    expect(await resolveSession(raw)).toBeNull()
  })

  it('refuses to resolve a session whose user is inactive', async () => {
    const raw = await createSession(userId)
    await db.update(users).set({ status: 'inactive' }).where(eq(users.id, userId))
    expect(await resolveSession(raw)).toBeNull()
    await db.update(users).set({ status: 'active' }).where(eq(users.id, userId))
  })

  it('revokes every session for a user', async () => {
    const a = await createSession(userId)
    const b = await createSession(userId)
    await revokeUserSessions(userId)
    expect(await resolveSession(a)).toBeNull()
    expect(await resolveSession(b)).toBeNull()
  })
})

describe('password reset tokens', () => {
  it('is single use', async () => {
    const raw = await createPasswordResetToken(userId)
    expect(await consumePasswordResetToken(raw)).toBe(userId)
    expect(await consumePasswordResetToken(raw)).toBeNull()
  })

  it('rejects an unknown token', async () => {
    expect(await consumePasswordResetToken('nope')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npm test -- tests/auth.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/auth"`.

- [ ] **Step 3: Implement `lib/auth.ts`**

```ts
import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { and, eq, gt, isNull, lt } from 'drizzle-orm'
import { db, type Executor } from '@/lib/db'
import { sessions, users, passwordResetTokens } from '@/db/schema'
import type { Role, UserStatus } from '@/db/schema'

const BCRYPT_COST = 12
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7
const RESET_TTL_MS = 1000 * 60 * 60

export type SessionUser = {
  id: string
  orgId: string
  name: string
  email: string
  role: Role
  status: UserStatus
  departmentId: string | null
  designation: string | null
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export async function createSession(userId: string, userAgent?: string | null): Promise<string> {
  const raw = randomBytes(32).toString('base64url')
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(raw),
    userAgent: userAgent ?? null,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  })
  return raw
}

export async function resolveSession(rawToken: string): Promise<SessionUser | null> {
  const [row] = await db
    .select({
      id: users.id, orgId: users.orgId, name: users.name, email: users.email,
      role: users.role, status: users.status,
      departmentId: users.departmentId, designation: users.designation,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(
      eq(sessions.tokenHash, hashToken(rawToken)),
      gt(sessions.expiresAt, new Date()),
      eq(users.status, 'active'),
    ))
    .limit(1)
  return row ?? null
}

export async function destroySession(rawToken: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(rawToken)))
}

export async function revokeUserSessions(userId: string, ex: Executor = db): Promise<void> {
  await ex.delete(sessions).where(eq(sessions.userId, userId))
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString('base64url')
  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  })
  return raw
}

export async function consumePasswordResetToken(rawToken: string): Promise<string | null> {
  const [row] = await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(
      eq(passwordResetTokens.tokenHash, hashToken(rawToken)),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, new Date()),
    ))
    .returning({ userId: passwordResetTokens.userId })
  return row?.userId ?? null
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
}
```

Note the reset-token consume is a single conditional `UPDATE … RETURNING`, so two concurrent redemptions cannot both succeed.

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm test -- tests/auth.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Implement `lib/tenant.ts`**

This is the only module that turns a request into an org scope.

```ts
import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { resolveSession, type SessionUser } from '@/lib/auth'

export const SESSION_COOKIE = 'memo_session'

/**
 * The only carrier of organization scope in the application.
 * It is constructible ONLY from a verified session — no function anywhere
 * accepts a caller-supplied orgId.
 */
export type TenantContext = { orgId: string; user: SessionUser }

export const getSession = cache(async (): Promise<TenantContext | null> => {
  const jar = await cookies()
  const raw = jar.get(SESSION_COOKIE)?.value
  if (!raw) return null
  const user = await resolveSession(raw)
  if (!user) return null
  return { orgId: user.orgId, user }
})

export async function requireSession(): Promise<TenantContext> {
  const ctx = await getSession()
  if (!ctx) redirect('/login')
  return ctx
}

export async function requireAdmin(): Promise<TenantContext> {
  const ctx = await requireSession()
  if (ctx.user.role !== 'org_admin') redirect('/dashboard')
  return ctx
}

export async function setSessionCookie(raw: string): Promise<void> {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}
```

- [ ] **Step 6: Add the cookie-presence middleware**

Create `middleware.ts` at the project root. This is a redirect convenience only — it is **not** the authorization mechanism.

```ts
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC = ['/login', '/register-organization', '/forgot-password', '/reset-password']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))
  const hasCookie = req.cookies.has('memo_session')

  if (!isPublic && !hasCookie) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }
  if (isPublic && hasCookie && pathname === '/login') {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
}
```

- [ ] **Step 7: Type-check and commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: password hashing, sessions, reset tokens and tenant context"
```

Expected: `tsc` exits 0.

---

### Task 3: Design system (impeccable pass) and app shell

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`
- Create: `components/ui/` primitives, `components/app-shell.tsx`, `components/nav.tsx`

**Interfaces:**
- Consumes: `getSession` from Task 2.
- Produces: CSS custom properties `--bg`, `--surface`, `--surface-raised`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-fg`, plus status tokens `--st-draft`, `--st-pending`, `--st-changes`, `--st-approved`, `--st-rejected`, `--st-cancelled` and priority tokens `--pr-normal`, `--pr-high`, `--pr-urgent`. Components: `<Button>`, `<Input>`, `<Select>`, `<Textarea>`, `<Card>`, `<Badge>`, `<StatusBadge status>`, `<PriorityBadge priority>`, `<EmptyState>`, `<PageHeader>`, `<DataTable>`, `<Tabs>`, `<Modal>`, `<Toast>`, `<AppShell>`.

- [ ] **Step 1: Invoke the impeccable skill**

Run the `impeccable` skill with this brief, and follow whatever it produces:

> A document-grade multi-tenant administrative interface for an inter-office memo approval system. Audience: office staff, department heads, directors. Tone: serious, calm, precise — closer to a well-set legal document than a SaaS dashboard. Quiet chrome, strong typographic hierarchy, one accent colour. Status and priority must occupy **different** visual channels so they never compete. The signature component is a workflow rail showing completed / current / future approval steps with the responsible person and the action required — it must be legible at a glance and on a phone. Light and dark themes. Deliver design tokens as CSS custom properties in `app/globals.css` plus the primitive components listed in this task's Interfaces block.

- [ ] **Step 2: Build the app shell**

`components/app-shell.tsx` renders: organization name and logo, primary navigation (Dashboard, Inbox with unread count, My Memos, Completed, Search, plus an Administration group for `org_admin`), a notification bell with unread count, and a user menu (Profile, Delegations, Change password, Log out). Collapses to a drawer below `md`.

Nav item list, exactly:

```tsx
const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/memos', label: 'My Memos' },
  { href: '/completed', label: 'Completed' },
  { href: '/search', label: 'Search' },
]
const ADMIN_NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/departments', label: 'Departments' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/templates', label: 'Workflow Templates' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/audit', label: 'Audit Log' },
  { href: '/admin/organization', label: 'Organization' },
]
```

- [ ] **Step 3: Verify responsiveness**

```bash
npm run dev
```

Open `http://localhost:3000`, then use the browser tools to check the shell at 375×812 and at desktop width. Expected: no horizontal scroll at 375px; nav collapses to a drawer.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: design system tokens, primitives and application shell"
```

---

### Task 4: Authentication pages and organization registration

**Files:**
- Create: `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register-organization/page.tsx`, `app/(auth)/forgot-password/page.tsx`, `app/(auth)/reset-password/[token]/page.tsx`, `app/(auth)/actions.ts`
- Create: `app/(app)/profile/page.tsx`, `app/(app)/profile/actions.ts`
- Create: `lib/audit.ts`
- Test: `tests/registration.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces:
  - `audit(ex: Executor, o: { orgId: string | null; actorId: string | null; eventType: string; entityType?: string; entityId?: string | null; description: string }): Promise<void>`
  - Server Actions `loginAction`, `logoutAction`, `registerOrganizationAction`, `requestPasswordResetAction`, `resetPasswordAction`, `updateProfileAction`, `changePasswordAction`, each returning `{ error: string } | void` and each redirecting on success.

- [ ] **Step 1: Implement `lib/audit.ts`**

```ts
import 'server-only'
import { db, type Executor } from '@/lib/db'
import { auditLog } from '@/db/schema'

export async function audit(ex: Executor = db, o: {
  orgId: string | null
  actorId: string | null
  eventType: string
  entityType?: string
  entityId?: string | null
  description: string
  ip?: string | null
}): Promise<void> {
  await ex.insert(auditLog).values({
    orgId: o.orgId, actorId: o.actorId, eventType: o.eventType,
    entityType: o.entityType ?? null, entityId: o.entityId ?? null,
    description: o.description, ip: o.ip ?? null,
  })
}
```

- [ ] **Step 2: Write the failing registration test**

Create `tests/registration.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { resetDb } from './helpers/db'
import { db } from '@/lib/db'
import { organizations, users, departments, memoCategories } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createOrganization } from '@/lib/org-setup'

beforeAll(async () => { await resetDb() })

describe('createOrganization', () => {
  it('creates the org, its first admin, and starter data', async () => {
    const r = await createOrganization({
      orgName: 'Northbridge University', orgCode: 'NBU',
      adminName: 'Ayesha Rahman', adminEmail: 'ayesha@nbu.test',
      password: 'correct horse battery',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const [org] = await db.select().from(organizations).where(eq(organizations.id, r.orgId))
    expect(org.slug).toBe('northbridge-university')

    const admins = await db.select().from(users).where(eq(users.orgId, r.orgId))
    expect(admins).toHaveLength(1)
    expect(admins[0].role).toBe('org_admin')
    expect(admins[0].passwordHash).not.toBe('correct horse battery')

    const cats = await db.select().from(memoCategories).where(eq(memoCategories.orgId, r.orgId))
    expect(cats.map((c) => c.name)).toContain('Administrative')

    const depts = await db.select().from(departments).where(eq(departments.orgId, r.orgId))
    expect(depts.length).toBeGreaterThan(0)
  })

  it('rejects a duplicate organization slug', async () => {
    const again = await createOrganization({
      orgName: 'Northbridge University', orgCode: 'NBU2',
      adminName: 'Someone', adminEmail: 'x@nbu.test', password: 'another password',
    })
    expect(again.ok).toBe(false)
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

```bash
npm test -- tests/registration.test.ts
```

Expected: FAIL — cannot resolve `@/lib/org-setup`.

- [ ] **Step 4: Implement `lib/org-setup.ts`**

```ts
import 'server-only'
import { db } from '@/lib/db'
import { organizations, users, departments, memoCategories, workflowTemplates, workflowTemplateSteps } from '@/db/schema'
import { hashPassword } from '@/lib/auth'
import { audit } from '@/lib/audit'

const STARTER_CATEGORIES = [
  ['Administrative', 'General administrative matters'],
  ['Financial', 'Budgets, expenditure and financial approvals'],
  ['Procurement', 'Purchase and vendor requests'],
  ['HR', 'Personnel, leave and recruitment'],
  ['Academic', 'Academic and curricular matters'],
  ['Technical', 'IT and infrastructure'],
  ['General', 'Anything not covered above'],
] as const

const STARTER_TEMPLATES = [
  { name: 'Purchase Request', steps: ['Employee', 'Department Head', 'Finance', 'Director'] },
  { name: 'Leave Request', steps: ['Employee', 'Line Manager', 'HR'] },
  { name: 'Procurement Request', steps: ['Requester', 'Department Head', 'Procurement', 'Finance', 'Director'] },
]

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

export type CreateOrgResult =
  | { ok: true; orgId: string; userId: string }
  | { ok: false; error: string }

export async function createOrganization(input: {
  orgName: string; orgCode: string
  adminName: string; adminEmail: string; password: string
  contactEmail?: string | null; contactPhone?: string | null; address?: string | null
}): Promise<CreateOrgResult> {
  const slug = slugify(input.orgName)
  const passwordHash = await hashPassword(input.password)

  try {
    return await db.transaction(async (tx) => {
      const [org] = await tx.insert(organizations).values({
        name: input.orgName.trim(), slug, code: input.orgCode.trim().toUpperCase(),
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        address: input.address ?? null,
        config: { memoPrefix: input.orgCode.trim().toUpperCase() },
      }).returning()

      const [dept] = await tx.insert(departments).values({
        orgId: org.id, name: 'Administration',
        description: 'Default department created with the organization',
      }).returning()

      await tx.insert(memoCategories).values(
        STARTER_CATEGORIES.map(([name, description]) => ({ orgId: org.id, name, description })),
      )

      for (const t of STARTER_TEMPLATES) {
        const [tpl] = await tx.insert(workflowTemplates)
          .values({ orgId: org.id, name: t.name }).returning()
        await tx.insert(workflowTemplateSteps).values(
          t.steps.map((positionTitle, i) => ({
            orgId: org.id, templateId: tpl.id, stepNo: i + 1,
            positionTitle, requiredAction: 'approve' as const,
          })),
        )
      }

      const [user] = await tx.insert(users).values({
        orgId: org.id, name: input.adminName.trim(),
        email: input.adminEmail.trim().toLowerCase(),
        designation: 'Organization Administrator',
        departmentId: dept.id, role: 'org_admin', passwordHash,
      }).returning()

      await audit(tx, {
        orgId: org.id, actorId: user.id, eventType: 'organization_created',
        entityType: 'organization', entityId: org.id,
        description: `Organization ${org.name} created`,
      })

      return { ok: true as const, orgId: org.id, userId: user.id }
    })
  } catch (e) {
    console.error('createOrganization failed', e)
    return { ok: false, error: 'That organization name is already taken.' }
  }
}
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
npm test -- tests/registration.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 6: Write the auth Server Actions**

Create `app/(auth)/actions.ts` with `'use server'` at the top. Each action validates with Zod first.

```ts
'use server'
import { z } from 'zod'
import { redirect } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/db/schema'
import {
  verifyPassword, createSession, destroySession, hashPassword,
  createPasswordResetToken, consumePasswordResetToken, revokeUserSessions,
} from '@/lib/auth'
import { setSessionCookie, clearSessionCookie, SESSION_COOKIE } from '@/lib/tenant'
import { createOrganization } from '@/lib/org-setup'
import { audit } from '@/lib/audit'
import { cookies, headers } from 'next/headers'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
})

export async function loginAction(_prev: unknown, formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Enter a valid email address and password.' }
  const { email, password, next } = parsed.data

  const [user] = await db.select().from(users)
    .where(eq(users.email, email.toLowerCase())).limit(1)

  // One generic message for unknown email, wrong password and inactive account:
  // the response must not reveal which accounts exist (§21.13).
  const bad = { error: 'Those credentials are not valid.' }
  if (!user) { await hashPassword('timing-equaliser'); return bad }
  if (!(await verifyPassword(password, user.passwordHash))) return bad
  if (user.status !== 'active') return bad

  const ua = (await headers()).get('user-agent')
  const raw = await createSession(user.id, ua)
  await setSessionCookie(raw)
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))
  await audit(undefined, {
    orgId: user.orgId, actorId: user.id, eventType: 'user_login',
    entityType: 'user', entityId: user.id, description: `${user.email} logged in`,
  })
  redirect(next && next.startsWith('/') ? next : '/dashboard')
}

export async function logoutAction() {
  const jar = await cookies()
  const raw = jar.get(SESSION_COOKIE)?.value
  if (raw) await destroySession(raw)
  await clearSessionCookie()
  redirect('/login')
}
```

`registerOrganizationAction` validates with:

```ts
const registerSchema = z.object({
  orgName: z.string().min(2).max(120),
  orgCode: z.string().min(2).max(12).regex(/^[A-Za-z0-9-]+$/),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().max(40).optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  adminName: z.string().min(2).max(120),
  adminEmail: z.string().email(),
  password: z.string().min(10, 'Use at least 10 characters.'),
})
```

then calls `createOrganization`, and on `ok` issues a session and redirects to `/dashboard`.

`requestPasswordResetAction` looks the user up, and **whether or not it finds one** returns the same confirmation. When it does find one it creates a token and logs the link:

```ts
console.info(`[password-reset] ${origin}/reset-password/${raw}`)
```

`resetPasswordAction` calls `consumePasswordResetToken`, and on a user id sets the new hash and calls `revokeUserSessions`.

- [ ] **Step 7: Build the pages**

`login/page.tsx` — email, password, links to Forgot password and Register organization.
`register-organization/page.tsx` — two fieldsets (Organization / Administrator account) with the fields above.
`forgot-password/page.tsx` — email field; always shows the same confirmation.
`reset-password/[token]/page.tsx` — new password twice.
`profile/page.tsx` — read-only Name/Email/Designation/Department/Role/Status per §2.2, editable name and designation, plus a Change password form that requires the current password and revokes other sessions.

- [ ] **Step 8: Verify the flow by hand**

```bash
npm run dev
```

Register an organization at `/register-organization`, confirm the redirect to `/dashboard`, log out, log back in, then run Forgot password and follow the link printed in the terminal. Expected: all four succeed.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: login, organization registration, password reset and profile"
```

---

### Task 5: Administration — departments, categories, users, organization profile

**Files:**
- Create: `app/(admin)/admin/departments/page.tsx` + `actions.ts`
- Create: `app/(admin)/admin/categories/page.tsx` + `actions.ts`
- Create: `app/(admin)/admin/users/page.tsx` + `actions.ts`
- Create: `app/(admin)/admin/organization/page.tsx` + `actions.ts`
- Create: `lib/repo/org.ts`
- Test: `tests/admin.test.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `TenantContext`, `audit`, `hashPassword`, `revokeUserSessions`.
- Produces: `lib/repo/org.ts` exporting `listDepartments(ctx, opts?)`, `listCategories(ctx, opts?)`, `listUsers(ctx, opts?)`, `getOrganization(ctx)`, `listActiveUsers(ctx)` — all taking `ctx: TenantContext` first.

- [ ] **Step 1: Write the failing tenant-isolation test for admin reads**

Create `tests/admin.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { resetDb } from './helpers/db'
import { createOrganization } from '@/lib/org-setup'
import { listDepartments, listUsers, listCategories } from '@/lib/repo/org'
import type { TenantContext } from '@/lib/tenant'
import { db } from '@/lib/db'
import { users, departments } from '@/db/schema'
import { eq } from 'drizzle-orm'

let a: TenantContext
let b: TenantContext

async function ctxFor(orgId: string, userId: string): Promise<TenantContext> {
  const [u] = await db.select().from(users).where(eq(users.id, userId))
  return { orgId, user: { ...u } }
}

beforeAll(async () => {
  await resetDb()
  const ra = await createOrganization({
    orgName: 'Northbridge University', orgCode: 'NBU',
    adminName: 'Ayesha', adminEmail: 'ayesha@nbu.test', password: 'password-one-x',
  })
  const rb = await createOrganization({
    orgName: 'Aurora Logistics', orgCode: 'AUR',
    adminName: 'Tanvir', adminEmail: 'tanvir@aurora.test', password: 'password-two-x',
  })
  if (!ra.ok || !rb.ok) throw new Error('setup failed')
  a = await ctxFor(ra.orgId, ra.userId)
  b = await ctxFor(rb.orgId, rb.userId)
})

describe('tenant isolation of admin reads', () => {
  it('lists only its own departments', async () => {
    await db.insert(departments).values({ orgId: a.orgId, name: 'Finance' })
    const forA = await listDepartments(a)
    const forB = await listDepartments(b)
    expect(forA.some((d) => d.name === 'Finance')).toBe(true)
    expect(forB.some((d) => d.name === 'Finance')).toBe(false)
  })

  it('lists only its own users', async () => {
    const forB = await listUsers(b)
    expect(forB.every((u) => u.orgId === b.orgId)).toBe(true)
    expect(forB.some((u) => u.email === 'ayesha@nbu.test')).toBe(false)
  })

  it('lists only its own categories', async () => {
    const forA = await listCategories(a)
    expect(forA.every((c) => c.orgId === a.orgId)).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npm test -- tests/admin.test.ts
```

Expected: FAIL — cannot resolve `@/lib/repo/org`.

- [ ] **Step 3: Implement `lib/repo/org.ts`**

Every function takes `ctx` first and filters on `ctx.orgId`.

```ts
import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { departments, memoCategories, users, organizations, workflowTemplates } from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'

export async function getOrganization(ctx: TenantContext) {
  const [org] = await db.select().from(organizations)
    .where(eq(organizations.id, ctx.orgId)).limit(1)
  return org
}

export async function listDepartments(ctx: TenantContext, opts?: { activeOnly?: boolean }) {
  return db.select().from(departments).where(
    opts?.activeOnly
      ? and(eq(departments.orgId, ctx.orgId), eq(departments.active, true))
      : eq(departments.orgId, ctx.orgId),
  ).orderBy(asc(departments.name))
}

export async function listCategories(ctx: TenantContext, opts?: { activeOnly?: boolean }) {
  return db.select().from(memoCategories).where(
    opts?.activeOnly
      ? and(eq(memoCategories.orgId, ctx.orgId), eq(memoCategories.active, true))
      : eq(memoCategories.orgId, ctx.orgId),
  ).orderBy(asc(memoCategories.name))
}

export async function listUsers(ctx: TenantContext) {
  return db.select({
    id: users.id, orgId: users.orgId, name: users.name, email: users.email,
    designation: users.designation, role: users.role, status: users.status,
    departmentId: users.departmentId, departmentName: departments.name,
    lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
  }).from(users)
    .leftJoin(departments, eq(departments.id, users.departmentId))
    .where(eq(users.orgId, ctx.orgId))
    .orderBy(asc(users.name))
}

export async function listActiveUsers(ctx: TenantContext) {
  return db.select({ id: users.id, name: users.name, designation: users.designation })
    .from(users)
    .where(and(eq(users.orgId, ctx.orgId), eq(users.status, 'active')))
    .orderBy(asc(users.name))
}

export async function listTemplates(ctx: TenantContext, opts?: { activeOnly?: boolean }) {
  return db.select().from(workflowTemplates).where(
    opts?.activeOnly
      ? and(eq(workflowTemplates.orgId, ctx.orgId), eq(workflowTemplates.active, true))
      : eq(workflowTemplates.orgId, ctx.orgId),
  ).orderBy(asc(workflowTemplates.name))
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm test -- tests/admin.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Build the admin Server Actions**

Each starts with `const ctx = await requireAdmin()`, validates with Zod, scopes every write by `and(eq(table.id, id), eq(table.orgId, ctx.orgId))`, and calls `audit`.

- Departments: `createDepartment`, `renameDepartment`, `setDepartmentActive`. **No delete** — §13 forbids losing historical memo information.
- Categories: `createCategory`, `updateCategory`, `setCategoryActive`.
- Users: `createUser` (name, email, designation, department, role, generated initial password shown once), `updateUser`, `setUserStatus` (deactivating also calls `revokeUserSessions`), `generateResetLink` (returns the reset URL for the admin to hand over).
- Organization: `updateOrganization` (name, code, contact fields, memo prefix) and `uploadLogo` (PNG/JPEG/SVG, ≤ 512 KB, stored as bytea and served from `/api/org-logo`).

- [ ] **Step 6: Build the admin pages**

Each page is a server component that calls `requireAdmin()` then the matching repo function, and renders a `DataTable` with inline forms. The users table shows name, email, designation, department, role, status, last login, and per-row actions.

- [ ] **Step 7: Verify by hand**

```bash
npm run dev
```

As the admin: create a department, create a user, deactivate them, confirm the deactivated user cannot log in. Expected: login returns the generic credentials message.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: administration of departments, categories, users and organization"
```

---

### Task 6: Memo drafts, rich text and attachments

**Files:**
- Create: `lib/sanitize.ts`, `lib/memo-number.ts`, `lib/repo/memo.ts`
- Create: `app/(app)/memos/new/page.tsx`, `app/(app)/memos/[id]/edit/page.tsx`, `app/(app)/memos/actions.ts`
- Create: `components/memo/editor.tsx`, `components/memo/attachment-list.tsx`, `components/memo/participant-picker.tsx`
- Create: `app/api/attachments/[id]/route.ts`
- Test: `tests/memo-draft.test.ts`

**Interfaces:**
- Consumes: `requireSession`, `TenantContext`, `listActiveUsers`, `listDepartments`, `listCategories`, `listTemplates`.
- Produces:
  - `sanitizeMemoHtml(dirty: string): string`
  - `nextMemoNumber(ex: Executor, orgId: string, prefix: string): Promise<string>`
  - `lib/repo/memo.ts`: `getMemoForViewer(ctx, memoId)`, `listMyMemos(ctx, filters)`, `listInbox(ctx, filters)`, `listCompleted(ctx, filters)`, `getMemoDetail(ctx, memoId)`
  - Server Actions `createDraftAction`, `updateDraftAction`, `deleteDraftAction`, `uploadAttachmentAction`, `deleteAttachmentAction`, `setParticipantsAction`
  - `ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024`, `ATTACHMENT_MAX_PER_MEMO = 10`, `ALLOWED_MIME: Record<string, string[]>`

- [ ] **Step 1: Write the failing test**

Create `tests/memo-draft.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { resetDb } from './helpers/db'
import { db } from '@/lib/db'
import { sanitizeMemoHtml } from '@/lib/sanitize'
import { nextMemoNumber } from '@/lib/memo-number'
import { organizations } from '@/db/schema'

let orgId: string
beforeAll(async () => {
  await resetDb()
  const [org] = await db.insert(organizations)
    .values({ name: 'NBU', slug: 'nbu', code: 'NBU' }).returning()
  orgId = org.id
})

describe('sanitizeMemoHtml', () => {
  it('keeps basic formatting', () => {
    const out = sanitizeMemoHtml('<p>Hello <strong>team</strong></p><ul><li>one</li></ul>')
    expect(out).toContain('<strong>team</strong>')
    expect(out).toContain('<li>one</li>')
  })

  it('strips script tags and inline handlers', () => {
    const out = sanitizeMemoHtml('<p onclick="steal()">hi</p><script>alert(1)</script>')
    expect(out).not.toContain('script')
    expect(out).not.toContain('onclick')
    expect(out).toContain('hi')
  })

  it('strips javascript: hrefs', () => {
    const out = sanitizeMemoHtml('<a href="javascript:alert(1)">x</a>')
    expect(out).not.toContain('javascript:')
  })
})

describe('nextMemoNumber', () => {
  it('increments per organization and never repeats under concurrency', async () => {
    const first = await nextMemoNumber(db, orgId, 'NBU')
    const second = await nextMemoNumber(db, orgId, 'NBU')
    expect(first).not.toBe(second)
    expect(first).toMatch(/^NBU-\d{4}-\d{4}$/)

    const batch = await Promise.all(
      Array.from({ length: 20 }, () => nextMemoNumber(db, orgId, 'NBU')),
    )
    expect(new Set(batch).size).toBe(20)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npm test -- tests/memo-draft.test.ts
```

Expected: FAIL — cannot resolve `@/lib/sanitize`.

- [ ] **Step 3: Implement `lib/sanitize.ts`**

```ts
import sanitizeHtml from 'sanitize-html'

/** Allowlist for memo bodies. Anything outside it is dropped, not escaped. */
export function sanitizeMemoHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 's', 'blockquote', 'code', 'pre',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'a', 'hr',
    ],
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  })
}

/** Plain text for search snippets and PDF export. */
export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim()
}
```

- [ ] **Step 4: Implement `lib/memo-number.ts`**

The counter row is upserted atomically, so concurrent creators cannot collide.

```ts
import 'server-only'
import { sql } from 'drizzle-orm'
import type { Executor } from '@/lib/db'

export async function nextMemoNumber(
  ex: Executor, orgId: string, prefix: string,
): Promise<string> {
  const year = new Date().getUTCFullYear()
  const rows = await ex.execute(sql`
    INSERT INTO memo_counters (org_id, year, seq) VALUES (${orgId}, ${year}, 1)
    ON CONFLICT (org_id, year) DO UPDATE SET seq = memo_counters.seq + 1
    RETURNING seq
  `)
  const seq = Number((rows as unknown as { seq: number }[])[0].seq)
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`
}
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
npm test -- tests/memo-draft.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Build the draft Server Actions**

`createDraftAction` validates:

```ts
const draftSchema = z.object({
  subject: z.string().min(3).max(200),
  bodyHtml: z.string().max(200_000),
  departmentId: z.string().uuid().nullable(),
  categoryId: z.string().uuid().nullable(),
  priority: z.enum(['normal', 'high', 'urgent']),
})
```

then, in a transaction: resolves the org's `memoPrefix`, calls `nextMemoNumber`, inserts the memo with `status: 'draft'` and `bodyHtml: sanitizeMemoHtml(...)`, and writes a `created` memo event plus an audit row. It verifies that `departmentId` and `categoryId` belong to `ctx.orgId` before use — a foreign id from another org is rejected.

`updateDraftAction` and `deleteDraftAction` both require `memo.authorId === ctx.user.id && memo.status === 'draft'`, checked against the database, not the form.

`setParticipantsAction` accepts an ordered `{ assigneeUserId, positionTitle, requiredAction }[]`, verifies every assignee is an **active user of `ctx.orgId`**, and stores them as the draft's pending step list.

- [ ] **Step 7: Build the attachment upload and the authorized download route**

`uploadAttachmentAction` enforces the constants, sanitizes the filename to its basename, and rejects anything whose extension and MIME disagree:

```ts
export const ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024
export const ATTACHMENT_MAX_PER_MEMO = 10
export const ALLOWED_MIME: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
}
```

Create `app/api/attachments/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memoAttachments } from '@/db/schema'
import { getSession } from '@/lib/tenant'
import { getMemoAccess } from '@/lib/authz'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSession()
  if (!ctx) return new NextResponse('Not found', { status: 404 })
  const { id } = await params

  const [att] = await db.select().from(memoAttachments)
    .where(and(eq(memoAttachments.id, id), eq(memoAttachments.orgId, ctx.orgId)))
    .limit(1)
  if (!att) return new NextResponse('Not found', { status: 404 })

  const access = await getMemoAccess(ctx, att.memoId)
  if (!access?.canView) return new NextResponse('Not found', { status: 404 })

  return new NextResponse(new Uint8Array(att.data), {
    headers: {
      'Content-Type': att.mime,
      'Content-Length': String(att.sizeBytes),
      'Content-Disposition':
        `attachment; filename="${encodeURIComponent(att.filename)}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}
```

Every failure path returns 404, so an attacker cannot distinguish "wrong org" from "does not exist".

- [ ] **Step 8: Build the editor and the memo form**

`components/memo/editor.tsx` is a client component wrapping Tiptap `StarterKit` with a bold/italic/underline/heading/list/quote/link toolbar, writing HTML into a hidden input. The server sanitizes on save regardless of what the client sends.

`memos/new/page.tsx` renders: subject, category, department, priority, body editor, attachments, and the workflow builder (pick a template to prefill positions, then assign a user per position, or build a custom sequence). Buttons: **Save draft** and **Submit**.

- [ ] **Step 9: Verify by hand, then commit**

```bash
npm run dev
```

Create a draft with formatting and a PDF attachment; reload the edit page and confirm both survive. Try uploading a 10 MB file — expected: rejected with a clear message.

```bash
git add -A
git commit -m "feat: memo drafts, rich text editor, attachments and authorized downloads"
```

---

### Task 7: The workflow engine

**Files:**
- Create: `lib/workflow.ts`, `lib/authz.ts`, `lib/notify.ts`
- Test: `tests/workflow.test.ts`, `tests/authz.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `type WorkflowAction = 'approve' | 'reject' | 'request_changes' | 'comment' | 'complete_review'`
  - `type ActResult = { ok: true; status: MemoStatus } | { ok: false; error: string }`
  - `submitMemo(ctx: TenantContext, memoId: string): Promise<ActResult>`
  - `actOnMemo(ctx: TenantContext, memoId: string, action: WorkflowAction, comment: string | null): Promise<ActResult>`
  - `resubmitMemo(ctx: TenantContext, memoId: string, mode: 'resume' | 'restart'): Promise<ActResult>`
  - `cancelMemo(ctx: TenantContext, memoId: string, reason: string | null): Promise<ActResult>`
  - `lib/authz.ts`: `type MemoAccess = { memoId, canView, canAct, canEdit, canCancel, actingForUserId: string | null }` and `getMemoAccess(ctx: TenantContext, memoId: string): Promise<MemoAccess | null>`, `activeDelegatorIds(ctx: TenantContext, delegateId: string, ex?: Executor): Promise<string[]>`
  - `lib/notify.ts`: `notify(ex: Executor, o: { orgId, userId, type: NotificationType, memoId?, title, body? }): Promise<void>`

- [ ] **Step 1: Write the failing workflow test**

Create `tests/workflow.test.ts`. This encodes the §4 worked example and every rule the spec states.

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { resetDb } from './helpers/db'
import { db } from '@/lib/db'
import { memos, workflowSteps, memoEvents, notifications, users } from '@/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { submitMemo, actOnMemo, resubmitMemo, cancelMemo } from '@/lib/workflow'
import { makeOrgFixture, type OrgFixture } from './helpers/fixtures'

let f: OrgFixture

beforeEach(async () => {
  await resetDb()
  // author + deptHead + finance + director, and a draft memo whose cycle-1
  // participants are [deptHead, finance, director], all approve steps.
  f = await makeOrgFixture()
})

async function statusOf(memoId: string) {
  const [m] = await db.select().from(memos).where(eq(memos.id, memoId))
  return m.status
}

describe('submit', () => {
  it('moves a draft to pending_approval and notifies the first participant', async () => {
    const r = await submitMemo(f.authorCtx, f.memoId)
    expect(r.ok).toBe(true)
    expect(await statusOf(f.memoId)).toBe('pending_approval')

    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    expect(m.currentCycle).toBe(1)
    expect(m.currentStepNo).toBe(1)
    expect(m.currentVersion).toBe(1)
    expect(m.submittedAt).not.toBeNull()

    const notes = await db.select().from(notifications)
      .where(eq(notifications.userId, f.deptHead.id))
    expect(notes.some((n) => n.type === 'action_required')).toBe(true)
  })

  it('refuses to submit a memo with no participants', async () => {
    await db.delete(workflowSteps).where(eq(workflowSteps.memoId, f.memoId))
    const r = await submitMemo(f.authorCtx, f.memoId)
    expect(r.ok).toBe(false)
  })

  it('refuses submission by anyone but the author', async () => {
    const r = await submitMemo(f.deptHeadCtx, f.memoId)
    expect(r.ok).toBe(false)
  })
})

describe('sequence enforcement', () => {
  beforeEach(async () => { await submitMemo(f.authorCtx, f.memoId) })

  it('lets the current participant approve and advances to the next', async () => {
    const r = await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', 'Looks fine')
    expect(r.ok).toBe(true)
    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    expect(m.currentStepNo).toBe(2)
    expect(m.status).toBe('pending_approval')
  })

  it('refuses an approval from a later participant while an earlier step is pending', async () => {
    const r = await actOnMemo(f.directorCtx, f.memoId, 'approve', null)
    expect(r.ok).toBe(false)
    expect(await statusOf(f.memoId)).toBe('pending_approval')
    const [step1] = await db.select().from(workflowSteps)
      .where(and(eq(workflowSteps.memoId, f.memoId), eq(workflowSteps.stepNo, 1)))
    expect(step1.outcome).toBe('pending')
  })

  it('refuses an action from a user who is not in the workflow at all', async () => {
    const r = await actOnMemo(f.outsiderCtx, f.memoId, 'approve', null)
    expect(r.ok).toBe(false)
  })

  it('refuses an action from another organization entirely', async () => {
    const r = await actOnMemo(f.otherOrgCtx, f.memoId, 'approve', null)
    expect(r.ok).toBe(false)
  })
})

describe('completion', () => {
  it('marks the memo approved once the final participant approves', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null)
    await actOnMemo(f.financeCtx, f.memoId, 'approve', null)
    const r = await actOnMemo(f.directorCtx, f.memoId, 'approve', 'Approved')
    expect(r.ok).toBe(true)

    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    expect(m.status).toBe('approved')
    expect(m.finalApproverId).toBe(f.director.id)
    expect(m.completedAt).not.toBeNull()

    const evs = await db.select().from(memoEvents)
      .where(eq(memoEvents.memoId, f.memoId)).orderBy(asc(memoEvents.createdAt))
    expect(evs.at(-1)?.type).toBe('completed')
  })

  it('makes an approved memo read-only to further workflow actions', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null)
    await actOnMemo(f.financeCtx, f.memoId, 'approve', null)
    await actOnMemo(f.directorCtx, f.memoId, 'approve', null)
    const r = await actOnMemo(f.directorCtx, f.memoId, 'approve', null)
    expect(r.ok).toBe(false)
  })
})

describe('rejection', () => {
  beforeEach(async () => { await submitMemo(f.authorCtx, f.memoId) })

  it('requires a reason', async () => {
    const r = await actOnMemo(f.deptHeadCtx, f.memoId, 'reject', null)
    expect(r.ok).toBe(false)
    expect(await statusOf(f.memoId)).toBe('pending_approval')
  })

  it('terminates the workflow and skips remaining steps', async () => {
    const r = await actOnMemo(f.deptHeadCtx, f.memoId, 'reject', 'Budget not available')
    expect(r.ok).toBe(true)
    expect(await statusOf(f.memoId)).toBe('rejected')

    const steps = await db.select().from(workflowSteps)
      .where(eq(workflowSteps.memoId, f.memoId)).orderBy(asc(workflowSteps.stepNo))
    expect(steps[0].outcome).toBe('rejected')
    expect(steps[1].outcome).toBe('skipped')
    expect(steps[2].outcome).toBe('skipped')
  })
})

describe('request changes and resubmission', () => {
  beforeEach(async () => { await submitMemo(f.authorCtx, f.memoId) })

  it('requires a comment', async () => {
    const r = await actOnMemo(f.deptHeadCtx, f.memoId, 'request_changes', '')
    expect(r.ok).toBe(false)
  })

  it('returns the memo to the author', async () => {
    await actOnMemo(f.deptHeadCtx, f.memoId, 'request_changes', 'Add the quotation')
    expect(await statusOf(f.memoId)).toBe('changes_requested')
    const notes = await db.select().from(notifications)
      .where(eq(notifications.userId, f.author.id))
    expect(notes.some((n) => n.type === 'changes_requested')).toBe(true)
  })

  it('resume mode returns to the participant who asked for changes', async () => {
    await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null)          // step 1 done
    await actOnMemo(f.financeCtx, f.memoId, 'request_changes', 'Fix the total')
    const r = await resubmitMemo(f.authorCtx, f.memoId, 'resume')
    expect(r.ok).toBe(true)

    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    expect(m.currentCycle).toBe(2)
    expect(m.currentStepNo).toBe(2)          // back at Finance, not at Dept Head
    expect(m.currentVersion).toBe(2)
    expect(m.status).toBe('pending_approval')

    const c2step1 = await db.select().from(workflowSteps).where(and(
      eq(workflowSteps.memoId, f.memoId), eq(workflowSteps.cycle, 2), eq(workflowSteps.stepNo, 1),
    ))
    expect(c2step1[0].outcome).toBe('approved')   // carried forward
  })

  it('restart mode goes back to the first participant', async () => {
    await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null)
    await actOnMemo(f.financeCtx, f.memoId, 'request_changes', 'Fix the total')
    await resubmitMemo(f.authorCtx, f.memoId, 'restart')

    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    expect(m.currentStepNo).toBe(1)
    const c2step1 = await db.select().from(workflowSteps).where(and(
      eq(workflowSteps.memoId, f.memoId), eq(workflowSteps.cycle, 2), eq(workflowSteps.stepNo, 1),
    ))
    expect(c2step1[0].outcome).toBe('pending')
  })

  it('keeps every previous version and every previous cycle', async () => {
    await actOnMemo(f.deptHeadCtx, f.memoId, 'request_changes', 'Rework')
    await resubmitMemo(f.authorCtx, f.memoId, 'resume')
    const cycle1 = await db.select().from(workflowSteps)
      .where(and(eq(workflowSteps.memoId, f.memoId), eq(workflowSteps.cycle, 1)))
    expect(cycle1).toHaveLength(3)
    expect(cycle1.find((s) => s.stepNo === 1)?.outcome).toBe('changes_requested')
  })

  it('refuses resubmission by anyone but the author', async () => {
    await actOnMemo(f.deptHeadCtx, f.memoId, 'request_changes', 'Rework')
    const r = await resubmitMemo(f.deptHeadCtx, f.memoId, 'resume')
    expect(r.ok).toBe(false)
  })
})

describe('comments', () => {
  it('lets a participant comment without advancing the workflow', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    const r = await actOnMemo(f.directorCtx, f.memoId, 'comment', 'Noting my view early')
    expect(r.ok).toBe(true)
    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    expect(m.currentStepNo).toBe(1)
    expect(m.status).toBe('pending_approval')
  })

  it('refuses a comment from a non-participant', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    const r = await actOnMemo(f.outsiderCtx, f.memoId, 'comment', 'butting in')
    expect(r.ok).toBe(false)
  })
})

describe('delegation', () => {
  it('lets an active delegate act and records both identities', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    await f.grantDelegation(f.deptHead.id, f.delegate.id)
    const r = await actOnMemo(f.delegateCtx, f.memoId, 'approve', 'Approved while Head is away')
    expect(r.ok).toBe(true)

    const [step] = await db.select().from(workflowSteps).where(and(
      eq(workflowSteps.memoId, f.memoId), eq(workflowSteps.cycle, 1), eq(workflowSteps.stepNo, 1),
    ))
    expect(step.actedByUserId).toBe(f.delegate.id)
    expect(step.onBehalfOfUserId).toBe(f.deptHead.id)
  })

  it('refuses an expired delegation', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    await f.grantDelegation(f.deptHead.id, f.delegate.id, { expired: true })
    const r = await actOnMemo(f.delegateCtx, f.memoId, 'approve', null)
    expect(r.ok).toBe(false)
  })
})

describe('cancellation', () => {
  it('lets the author cancel an in-progress memo', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    const r = await cancelMemo(f.authorCtx, f.memoId, 'No longer needed')
    expect(r.ok).toBe(true)
    expect(await statusOf(f.memoId)).toBe('cancelled')
  })

  it('refuses cancellation by an unrelated user', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    const r = await cancelMemo(f.outsiderCtx, f.memoId, 'mischief')
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Write the fixture helper**

Create `tests/helpers/fixtures.ts`:

```ts
import { db } from '@/lib/db'
import {
  organizations, users, departments, memos, workflowSteps, delegations, memoCounters,
} from '@/db/schema'
import { hashPassword } from '@/lib/auth'
import type { TenantContext } from '@/lib/tenant'
import type { SessionUser } from '@/lib/auth'

function ctxOf(u: SessionUser): TenantContext { return { orgId: u.orgId, user: u } }

export type OrgFixture = {
  orgId: string
  memoId: string
  author: SessionUser; deptHead: SessionUser; finance: SessionUser
  director: SessionUser; outsider: SessionUser; delegate: SessionUser
  otherOrgUser: SessionUser
  authorCtx: TenantContext; deptHeadCtx: TenantContext; financeCtx: TenantContext
  directorCtx: TenantContext; outsiderCtx: TenantContext; delegateCtx: TenantContext
  otherOrgCtx: TenantContext
  grantDelegation(delegatorId: string, delegateId: string, o?: { expired?: boolean }): Promise<void>
}

async function mkUser(orgId: string, deptId: string, name: string, email: string) {
  const [u] = await db.insert(users).values({
    orgId, departmentId: deptId, name, email,
    passwordHash: await hashPassword('test-password-1'),
  }).returning()
  return {
    id: u.id, orgId: u.orgId, name: u.name, email: u.email, role: u.role,
    status: u.status, departmentId: u.departmentId, designation: u.designation,
  } satisfies SessionUser
}

export async function makeOrgFixture(): Promise<OrgFixture> {
  const [org] = await db.insert(organizations)
    .values({ name: 'Northbridge University', slug: 'nbu', code: 'NBU' }).returning()
  const [dept] = await db.insert(departments)
    .values({ orgId: org.id, name: 'Finance' }).returning()

  const author = await mkUser(org.id, dept.id, 'Ayesha Rahman', 'ayesha@nbu.test')
  const deptHead = await mkUser(org.id, dept.id, 'Karim Uddin', 'karim@nbu.test')
  const finance = await mkUser(org.id, dept.id, 'Nadia Haque', 'nadia@nbu.test')
  const director = await mkUser(org.id, dept.id, 'Imran Chowdhury', 'imran@nbu.test')
  const outsider = await mkUser(org.id, dept.id, 'Sabrina Islam', 'sabrina@nbu.test')
  const delegate = await mkUser(org.id, dept.id, 'Rafi Ahmed', 'rafi@nbu.test')

  const [other] = await db.insert(organizations)
    .values({ name: 'Aurora Logistics', slug: 'aurora', code: 'AUR' }).returning()
  const [otherDept] = await db.insert(departments)
    .values({ orgId: other.id, name: 'Ops' }).returning()
  const otherOrgUser = await mkUser(other.id, otherDept.id, 'Tanvir Alam', 'tanvir@aurora.test')

  await db.insert(memoCounters).values({ orgId: org.id, year: new Date().getUTCFullYear(), seq: 0 })
  const [memo] = await db.insert(memos).values({
    orgId: org.id, memoNumber: 'NBU-2026-0001', subject: 'Laboratory equipment purchase',
    bodyHtml: '<p>Requesting approval to purchase two oscilloscopes.</p>',
    authorId: author.id, departmentId: dept.id, priority: 'high', status: 'draft',
  }).returning()

  await db.insert(workflowSteps).values(
    [deptHead, finance, director].map((u, i) => ({
      orgId: org.id, memoId: memo.id, cycle: 1, stepNo: i + 1,
      positionTitle: ['Department Head', 'Finance Manager', 'Director'][i],
      assigneeUserId: u.id, requiredAction: 'approve' as const, outcome: 'pending' as const,
    })),
  )

  return {
    orgId: org.id, memoId: memo.id,
    author, deptHead, finance, director, outsider, delegate, otherOrgUser,
    authorCtx: ctxOf(author), deptHeadCtx: ctxOf(deptHead), financeCtx: ctxOf(finance),
    directorCtx: ctxOf(director), outsiderCtx: ctxOf(outsider), delegateCtx: ctxOf(delegate),
    otherOrgCtx: ctxOf(otherOrgUser),
    async grantDelegation(delegatorId, delegateId, o) {
      const now = Date.now()
      await db.insert(delegations).values({
        orgId: org.id, delegatorId, delegateId,
        startAt: new Date(now - 86400000),
        endAt: new Date(o?.expired ? now - 3600000 : now + 86400000),
        status: 'active',
      })
    },
  }
}
```

Note: the draft's participants live in `workflow_steps` at `cycle: 1, outcome: 'pending'` before submission; `submitMemo` treats an existing cycle-1 step set as the participant list rather than creating a second one.

- [ ] **Step 3: Run the test to confirm it fails**

```bash
npm test -- tests/workflow.test.ts
```

Expected: FAIL — cannot resolve `@/lib/workflow`.

- [ ] **Step 4: Implement `lib/notify.ts`**

```ts
import 'server-only'
import { db, type Executor } from '@/lib/db'
import { notifications } from '@/db/schema'
import type { NotificationType } from '@/db/schema'

export async function notify(ex: Executor = db, o: {
  orgId: string; userId: string; type: NotificationType
  memoId?: string | null; title: string; body?: string | null
}): Promise<void> {
  await ex.insert(notifications).values({
    orgId: o.orgId, userId: o.userId, type: o.type,
    memoId: o.memoId ?? null, title: o.title, body: o.body ?? null,
  })
}

export async function notifyMany(ex: Executor, userIds: string[], o: {
  orgId: string; type: NotificationType; memoId?: string | null; title: string; body?: string | null
}): Promise<void> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return
  await ex.insert(notifications).values(unique.map((userId) => ({
    orgId: o.orgId, userId, type: o.type,
    memoId: o.memoId ?? null, title: o.title, body: o.body ?? null,
  })))
}
```

- [ ] **Step 5: Implement `lib/authz.ts`**

```ts
import 'server-only'
import { and, eq, gt, lte, or, sql } from 'drizzle-orm'
import { db, type Executor } from '@/lib/db'
import { memos, workflowSteps, delegations } from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'

export type MemoAccess = {
  memoId: string
  canView: boolean
  canAct: boolean
  canEdit: boolean
  canCancel: boolean
  /** Set when the viewer may act only because someone delegated to them. */
  actingForUserId: string | null
}

/** Ids of users who have delegated their authority to `delegateId` right now. */
export async function activeDelegatorIds(
  ctx: TenantContext, delegateId: string, ex: Executor = db,
): Promise<string[]> {
  const now = new Date()
  const rows = await ex.select({ id: delegations.delegatorId }).from(delegations)
    .where(and(
      eq(delegations.orgId, ctx.orgId),
      eq(delegations.delegateId, delegateId),
      eq(delegations.status, 'active'),
      lte(delegations.startAt, now),
      gt(delegations.endAt, now),
    ))
  return rows.map((r) => r.id)
}

const TERMINAL = ['approved', 'rejected', 'cancelled'] as const

export async function getMemoAccess(
  ctx: TenantContext, memoId: string, ex: Executor = db,
): Promise<MemoAccess | null> {
  const [memo] = await ex.select().from(memos)
    .where(and(eq(memos.id, memoId), eq(memos.orgId, ctx.orgId)))
    .limit(1)
  if (!memo) return null                       // wrong org reads as "does not exist"

  const isAuthor = memo.authorId === ctx.user.id
  const isAdmin = ctx.user.role === 'org_admin'

  const participation = await ex.select({
    stepNo: workflowSteps.stepNo,
    cycle: workflowSteps.cycle,
    assignee: workflowSteps.assigneeUserId,
  }).from(workflowSteps).where(eq(workflowSteps.memoId, memoId))

  const delegators = await activeDelegatorIds(ctx, ctx.user.id, ex)
  const actsFor = new Set([ctx.user.id, ...delegators])

  const isParticipant = participation.some((s) => actsFor.has(s.assignee))
  const canView = isAuthor || isAdmin || isParticipant

  const terminal = (TERMINAL as readonly string[]).includes(memo.status)
  let canAct = false
  let actingForUserId: string | null = null

  if (!terminal && memo.currentStepNo != null && memo.currentCycle > 0) {
    const current = participation.find(
      (s) => s.cycle === memo.currentCycle && s.stepNo === memo.currentStepNo,
    )
    if (current && actsFor.has(current.assignee)) {
      canAct = true
      actingForUserId = current.assignee === ctx.user.id ? null : current.assignee
    }
  }

  const canEdit = isAuthor && (memo.status === 'draft' || memo.status === 'changes_requested')
  const canCancel = (isAuthor || isAdmin) && !terminal && memo.status !== 'draft'

  return { memoId, canView, canAct, canEdit, canCancel, actingForUserId }
}
```

- [ ] **Step 6: Implement `lib/workflow.ts`**

Every exported action follows the same shape: open a transaction, lock the memo row, assert, mutate, record the event, notify, audit.

```ts
import 'server-only'
import { and, asc, eq, ne, sql } from 'drizzle-orm'
import { db, type Tx } from '@/lib/db'
import {
  memos, workflowSteps, memoEvents, memoVersions, users,
  type MemoStatus, type EventType,
} from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'
import { notify, notifyMany } from '@/lib/notify'
import { audit } from '@/lib/audit'
import { activeDelegatorIds } from '@/lib/authz'

export type WorkflowAction =
  | 'approve' | 'reject' | 'request_changes' | 'comment' | 'complete_review'

export type ActResult =
  | { ok: true; status: MemoStatus }
  | { ok: false; error: string }

const TERMINAL: MemoStatus[] = ['approved', 'rejected', 'cancelled']

/** Locks the memo row for the rest of the transaction. */
async function lockMemo(tx: Tx, ctx: TenantContext, memoId: string) {
  const rows = await tx.execute(sql`
    SELECT * FROM memos WHERE id = ${memoId} AND org_id = ${ctx.orgId} FOR UPDATE
  `)
  return (rows as unknown as (typeof memos.$inferSelect)[])[0] ?? null
}

async function event(tx: Tx, o: {
  orgId: string; memoId: string; type: EventType; actorId: string
  onBehalfOfId?: string | null; cycle?: number | null; stepNo?: number | null
  comment?: string | null; detail?: string | null
}) {
  await tx.insert(memoEvents).values({
    orgId: o.orgId, memoId: o.memoId, type: o.type, actorId: o.actorId,
    onBehalfOfId: o.onBehalfOfId ?? null, cycle: o.cycle ?? null,
    stepNo: o.stepNo ?? null, comment: o.comment ?? null, detail: o.detail ?? null,
  })
}

async function touch(tx: Tx, memoId: string, patch: Partial<typeof memos.$inferInsert>) {
  await tx.update(memos)
    .set({ ...patch, lastActivityAt: new Date() })
    .where(eq(memos.id, memoId))
}

function statusForStep(requiredAction: 'approve' | 'review'): MemoStatus {
  return requiredAction === 'review' ? 'pending_review' : 'pending_approval'
}

export async function submitMemo(ctx: TenantContext, memoId: string): Promise<ActResult> {
  return db.transaction(async (tx) => {
    const memo = await lockMemo(tx, ctx, memoId)
    if (!memo) return { ok: false, error: 'Memo not found.' }
    if (memo.authorId !== ctx.user.id) return { ok: false, error: 'Only the author may submit this memo.' }
    if (memo.status !== 'draft') return { ok: false, error: 'Only a draft can be submitted.' }

    const steps = await tx.select().from(workflowSteps)
      .where(and(eq(workflowSteps.memoId, memoId), eq(workflowSteps.cycle, 1)))
      .orderBy(asc(workflowSteps.stepNo))
    if (steps.length === 0) {
      return { ok: false, error: 'Add at least one workflow participant before submitting.' }
    }

    await tx.insert(memoVersions).values({
      orgId: ctx.orgId, memoId, versionNo: 1, subject: memo.subject,
      bodyHtml: memo.bodyHtml, editorId: ctx.user.id, submittedAt: new Date(),
    })

    const first = steps[0]
    const status = statusForStep(first.requiredAction)
    await touch(tx, memoId, {
      status, currentCycle: 1, currentStepNo: first.stepNo,
      currentVersion: 1, submittedAt: new Date(),
    })

    await event(tx, { orgId: ctx.orgId, memoId, type: 'submitted', actorId: ctx.user.id, cycle: 1, stepNo: 1 })
    await event(tx, {
      orgId: ctx.orgId, memoId, type: 'forwarded', actorId: ctx.user.id, cycle: 1, stepNo: first.stepNo,
      detail: `Forwarded to step ${first.stepNo}`,
    })

    await notifyMany(tx, steps.map((s) => s.assigneeUserId), {
      orgId: ctx.orgId, type: 'workflow_assigned', memoId,
      title: `You are a participant on ${memo.memoNumber}`, body: memo.subject,
    })
    await notify(tx, {
      orgId: ctx.orgId, userId: first.assigneeUserId, type: 'action_required', memoId,
      title: `${memo.memoNumber} needs your ${first.requiredAction === 'review' ? 'review' : 'approval'}`,
      body: memo.subject,
    })
    await audit(tx, {
      orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'memo_submitted',
      entityType: 'memo', entityId: memoId, description: `${memo.memoNumber} submitted`,
    })
    return { ok: true, status }
  })
}

export async function actOnMemo(
  ctx: TenantContext, memoId: string, action: WorkflowAction, comment: string | null,
): Promise<ActResult> {
  const text = comment?.trim() || null
  if ((action === 'reject' || action === 'request_changes') && !text) {
    return { ok: false, error: action === 'reject'
      ? 'A rejection requires a reason.'
      : 'A change request requires a comment explaining what to change.' }
  }

  return db.transaction(async (tx) => {
    const memo = await lockMemo(tx, ctx, memoId)
    if (!memo) return { ok: false, error: 'Memo not found.' }
    if (TERMINAL.includes(memo.status)) return { ok: false, error: 'This memo is closed.' }
    if (memo.currentStepNo == null) return { ok: false, error: 'This memo is not in a workflow.' }

    const delegators = await activeDelegatorIds(ctx, ctx.user.id, tx)
    const actsFor = new Set([ctx.user.id, ...delegators])

    const allSteps = await tx.select().from(workflowSteps)
      .where(and(eq(workflowSteps.memoId, memoId), eq(workflowSteps.cycle, memo.currentCycle)))
      .orderBy(asc(workflowSteps.stepNo))

    // A comment does not advance the workflow, so any participant or the author may leave one.
    if (action === 'comment') {
      const isParticipant = allSteps.some((s) => actsFor.has(s.assigneeUserId))
      if (!isParticipant && memo.authorId !== ctx.user.id) {
        return { ok: false, error: 'Only the author and workflow participants may comment.' }
      }
      await event(tx, {
        orgId: ctx.orgId, memoId, type: 'comment', actorId: ctx.user.id,
        cycle: memo.currentCycle, stepNo: memo.currentStepNo, comment: text,
      })
      await touch(tx, memoId, {})
      const recipients = [memo.authorId, ...allSteps.map((s) => s.assigneeUserId)]
        .filter((id) => id !== ctx.user.id)
      await notifyMany(tx, recipients, {
        orgId: ctx.orgId, type: 'comment_added', memoId,
        title: `New comment on ${memo.memoNumber}`, body: text,
      })
      await audit(tx, {
        orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'comment',
        entityType: 'memo', entityId: memoId, description: `Comment on ${memo.memoNumber}`,
      })
      return { ok: true, status: memo.status }
    }

    const current = allSteps.find((s) => s.stepNo === memo.currentStepNo)
    if (!current) return { ok: false, error: 'Workflow step not found.' }
    if (!actsFor.has(current.assigneeUserId)) {
      return { ok: false, error: 'It is not your turn to act on this memo.' }
    }
    if (action === 'complete_review' && current.requiredAction !== 'review') {
      return { ok: false, error: 'This step requires an approval decision.' }
    }
    if (action === 'approve' && current.requiredAction !== 'approve') {
      return { ok: false, error: 'This step requires a review, not an approval.' }
    }

    const onBehalfOfId = current.assigneeUserId === ctx.user.id ? null : current.assigneeUserId
    const now = new Date()
    const outcome =
      action === 'approve' ? 'approved' :
      action === 'complete_review' ? 'reviewed' :
      action === 'reject' ? 'rejected' : 'changes_requested'

    await tx.update(workflowSteps)
      .set({ outcome, actedByUserId: ctx.user.id, onBehalfOfUserId: onBehalfOfId, actedAt: now, comment: text })
      .where(eq(workflowSteps.id, current.id))

    const eventType: EventType =
      action === 'approve' ? 'approved' :
      action === 'complete_review' ? 'reviewed' :
      action === 'reject' ? 'rejected' : 'changes_requested'

    await event(tx, {
      orgId: ctx.orgId, memoId, type: eventType, actorId: ctx.user.id,
      onBehalfOfId, cycle: memo.currentCycle, stepNo: current.stepNo, comment: text,
    })

    const participants = allSteps.map((s) => s.assigneeUserId)

    if (action === 'reject') {
      await tx.update(workflowSteps).set({ outcome: 'skipped' }).where(and(
        eq(workflowSteps.memoId, memoId),
        eq(workflowSteps.cycle, memo.currentCycle),
        eq(workflowSteps.outcome, 'pending'),
      ))
      await touch(tx, memoId, { status: 'rejected', currentStepNo: null, completedAt: now })
      await notifyMany(tx, [memo.authorId, ...participants].filter((id) => id !== ctx.user.id), {
        orgId: ctx.orgId, type: 'rejected', memoId,
        title: `${memo.memoNumber} was rejected`, body: text,
      })
      await audit(tx, {
        orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'memo_rejected',
        entityType: 'memo', entityId: memoId, description: `${memo.memoNumber} rejected`,
      })
      return { ok: true, status: 'rejected' }
    }

    if (action === 'request_changes') {
      await touch(tx, memoId, { status: 'changes_requested' })
      await notify(tx, {
        orgId: ctx.orgId, userId: memo.authorId, type: 'changes_requested', memoId,
        title: `Changes requested on ${memo.memoNumber}`, body: text,
      })
      await audit(tx, {
        orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'change_request',
        entityType: 'memo', entityId: memoId, description: `Changes requested on ${memo.memoNumber}`,
      })
      return { ok: true, status: 'changes_requested' }
    }

    // approve / complete_review — advance or complete
    const next = allSteps.find((s) => s.stepNo > current.stepNo && s.outcome === 'pending')

    if (!next) {
      await touch(tx, memoId, {
        status: 'approved', currentStepNo: null,
        completedAt: now, finalApproverId: ctx.user.id,
      })
      await event(tx, {
        orgId: ctx.orgId, memoId, type: 'completed', actorId: ctx.user.id,
        cycle: memo.currentCycle, stepNo: current.stepNo,
        detail: 'Workflow completed — memo approved',
      })
      await notifyMany(tx, [memo.authorId, ...participants], {
        orgId: ctx.orgId, type: 'workflow_completed', memoId,
        title: `${memo.memoNumber} is fully approved`, body: memo.subject,
      })
      await audit(tx, {
        orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'workflow_completed',
        entityType: 'memo', entityId: memoId, description: `${memo.memoNumber} approved`,
      })
      return { ok: true, status: 'approved' }
    }

    const status = statusForStep(next.requiredAction)
    await touch(tx, memoId, { status, currentStepNo: next.stepNo })
    await event(tx, {
      orgId: ctx.orgId, memoId, type: 'forwarded', actorId: ctx.user.id,
      cycle: memo.currentCycle, stepNo: next.stepNo, detail: `Forwarded to step ${next.stepNo}`,
    })
    await notify(tx, {
      orgId: ctx.orgId, userId: next.assigneeUserId, type: 'action_required', memoId,
      title: `${memo.memoNumber} needs your ${next.requiredAction === 'review' ? 'review' : 'approval'}`,
      body: memo.subject,
    })
    await audit(tx, {
      orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'memo_approved',
      entityType: 'memo', entityId: memoId,
      description: `${memo.memoNumber} ${outcome} at step ${current.stepNo}`,
    })
    return { ok: true, status }
  })
}

export async function resubmitMemo(
  ctx: TenantContext, memoId: string, mode: 'resume' | 'restart',
): Promise<ActResult> {
  return db.transaction(async (tx) => {
    const memo = await lockMemo(tx, ctx, memoId)
    if (!memo) return { ok: false, error: 'Memo not found.' }
    if (memo.authorId !== ctx.user.id) return { ok: false, error: 'Only the author may resubmit this memo.' }
    if (memo.status !== 'changes_requested') {
      return { ok: false, error: 'Only a memo with changes requested can be resubmitted.' }
    }

    const prev = await tx.select().from(workflowSteps)
      .where(and(eq(workflowSteps.memoId, memoId), eq(workflowSteps.cycle, memo.currentCycle)))
      .orderBy(asc(workflowSteps.stepNo))

    const requester = prev.find((s) => s.outcome === 'changes_requested')
    const cycle = memo.currentCycle + 1
    const versionNo = memo.currentVersion + 1
    const now = new Date()

    await tx.insert(memoVersions).values({
      orgId: ctx.orgId, memoId, versionNo, subject: memo.subject,
      bodyHtml: memo.bodyHtml, editorId: ctx.user.id, submittedAt: now,
    })

    // Carry approvals forward in `resume` mode; wipe them in `restart` mode.
    const resumeAt = mode === 'resume' && requester ? requester.stepNo : prev[0].stepNo
    await tx.insert(workflowSteps).values(prev.map((s) => ({
      orgId: ctx.orgId, memoId, cycle, stepNo: s.stepNo,
      positionTitle: s.positionTitle, assigneeUserId: s.assigneeUserId,
      requiredAction: s.requiredAction,
      outcome: (mode === 'resume' && s.stepNo < resumeAt ? s.outcome : 'pending') as typeof s.outcome,
      actedByUserId: mode === 'resume' && s.stepNo < resumeAt ? s.actedByUserId : null,
      onBehalfOfUserId: mode === 'resume' && s.stepNo < resumeAt ? s.onBehalfOfUserId : null,
      actedAt: mode === 'resume' && s.stepNo < resumeAt ? s.actedAt : null,
      comment: mode === 'resume' && s.stepNo < resumeAt ? s.comment : null,
    })))

    const target = prev.find((s) => s.stepNo === resumeAt)!
    const status = statusForStep(target.requiredAction)
    await touch(tx, memoId, {
      status, currentCycle: cycle, currentStepNo: resumeAt, currentVersion: versionNo,
    })

    await event(tx, {
      orgId: ctx.orgId, memoId, type: 'version_created', actorId: ctx.user.id,
      cycle, detail: `Version ${versionNo} created`,
    })
    await event(tx, {
      orgId: ctx.orgId, memoId, type: 'resubmitted', actorId: ctx.user.id, cycle, stepNo: resumeAt,
      detail: mode === 'resume'
        ? `Resubmitted — resumed at step ${resumeAt}`
        : 'Resubmitted — workflow restarted from the first participant',
    })
    await notify(tx, {
      orgId: ctx.orgId, userId: target.assigneeUserId, type: 'resubmitted', memoId,
      title: `${memo.memoNumber} was revised and needs your attention`, body: memo.subject,
    })
    await audit(tx, {
      orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'memo_resubmitted',
      entityType: 'memo', entityId: memoId,
      description: `${memo.memoNumber} resubmitted as version ${versionNo}`,
    })
    return { ok: true, status }
  })
}

export async function cancelMemo(
  ctx: TenantContext, memoId: string, reason: string | null,
): Promise<ActResult> {
  return db.transaction(async (tx) => {
    const memo = await lockMemo(tx, ctx, memoId)
    if (!memo) return { ok: false, error: 'Memo not found.' }
    const allowed = memo.authorId === ctx.user.id || ctx.user.role === 'org_admin'
    if (!allowed) return { ok: false, error: 'You cannot cancel this memo.' }
    if (TERMINAL.includes(memo.status)) return { ok: false, error: 'This memo is already closed.' }
    if (memo.status === 'draft') return { ok: false, error: 'Delete the draft instead of cancelling it.' }

    const steps = await tx.select().from(workflowSteps)
      .where(and(eq(workflowSteps.memoId, memoId), eq(workflowSteps.cycle, memo.currentCycle)))
    await tx.update(workflowSteps).set({ outcome: 'skipped' }).where(and(
      eq(workflowSteps.memoId, memoId),
      eq(workflowSteps.cycle, memo.currentCycle),
      eq(workflowSteps.outcome, 'pending'),
    ))
    await touch(tx, memoId, {
      status: 'cancelled', currentStepNo: null, cancelledAt: new Date(),
    })
    await event(tx, {
      orgId: ctx.orgId, memoId, type: 'cancelled', actorId: ctx.user.id,
      cycle: memo.currentCycle, comment: reason,
    })
    await notifyMany(tx, steps.map((s) => s.assigneeUserId).filter((id) => id !== ctx.user.id), {
      orgId: ctx.orgId, type: 'rejected', memoId,
      title: `${memo.memoNumber} was cancelled`, body: reason,
    })
    await audit(tx, {
      orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'memo_cancelled',
      entityType: 'memo', entityId: memoId, description: `${memo.memoNumber} cancelled`,
    })
    return { ok: true, status: 'cancelled' }
  })
}
```

- [ ] **Step 7: Run the workflow test to confirm it passes**

```bash
npm test -- tests/workflow.test.ts
```

Expected: PASS, 20 tests. Fix the implementation, never the assertions, if any fail.

- [ ] **Step 8: Write and run the authz test**

Create `tests/authz.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { resetDb } from './helpers/db'
import { getMemoAccess } from '@/lib/authz'
import { submitMemo, actOnMemo } from '@/lib/workflow'
import { makeOrgFixture, type OrgFixture } from './helpers/fixtures'

let f: OrgFixture
beforeEach(async () => { await resetDb(); f = await makeOrgFixture() })

describe('getMemoAccess', () => {
  it('returns null for a memo in another organization', async () => {
    expect(await getMemoAccess(f.otherOrgCtx, f.memoId)).toBeNull()
  })

  it('denies view to an unrelated user in the same organization', async () => {
    const a = await getMemoAccess(f.outsiderCtx, f.memoId)
    expect(a?.canView).toBe(false)
  })

  it('grants view to the author, participants and admins', async () => {
    expect((await getMemoAccess(f.authorCtx, f.memoId))?.canView).toBe(true)
    expect((await getMemoAccess(f.directorCtx, f.memoId))?.canView).toBe(true)
  })

  it('grants canAct only to the current step assignee', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    expect((await getMemoAccess(f.deptHeadCtx, f.memoId))?.canAct).toBe(true)
    expect((await getMemoAccess(f.financeCtx, f.memoId))?.canAct).toBe(false)
    expect((await getMemoAccess(f.directorCtx, f.memoId))?.canAct).toBe(false)
  })

  it('reports actingForUserId for a delegate', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    await f.grantDelegation(f.deptHead.id, f.delegate.id)
    const a = await getMemoAccess(f.delegateCtx, f.memoId)
    expect(a?.canAct).toBe(true)
    expect(a?.actingForUserId).toBe(f.deptHead.id)
  })

  it('lets the author edit a draft and a changes-requested memo, but not one in flight', async () => {
    expect((await getMemoAccess(f.authorCtx, f.memoId))?.canEdit).toBe(true)
    await submitMemo(f.authorCtx, f.memoId)
    expect((await getMemoAccess(f.authorCtx, f.memoId))?.canEdit).toBe(false)
    await actOnMemo(f.deptHeadCtx, f.memoId, 'request_changes', 'Please revise')
    expect((await getMemoAccess(f.authorCtx, f.memoId))?.canEdit).toBe(true)
  })

  it('denies every action once the memo is approved', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null)
    await actOnMemo(f.financeCtx, f.memoId, 'approve', null)
    await actOnMemo(f.directorCtx, f.memoId, 'approve', null)
    const a = await getMemoAccess(f.directorCtx, f.memoId)
    expect(a?.canAct).toBe(false)
    expect(a?.canCancel).toBe(false)
  })
})
```

```bash
npm test -- tests/authz.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: workflow state machine, memo authorization and notifications"
```

---

### Task 8: Memo detail page — workflow rail, timeline, comments, actions

**Files:**
- Create: `app/(app)/memos/[id]/page.tsx`, `app/(app)/memos/[id]/workflow-actions.ts`
- Create: `components/memo/workflow-rail.tsx`, `components/memo/timeline.tsx`, `components/memo/action-panel.tsx`, `components/memo/status-badge.tsx`, `components/memo/priority-badge.tsx`
- Modify: `lib/repo/memo.ts` (add `getMemoDetail`)

**Interfaces:**
- Consumes: `getMemoAccess`, `submitMemo`, `actOnMemo`, `resubmitMemo`, `cancelMemo`.
- Produces: `getMemoDetail(ctx, memoId)` returning `{ memo, author, department, category, steps, events, attachments, versions, access } | null`; Server Actions `submitAction`, `workflowAction`, `resubmitAction`, `cancelAction`, each re-deriving authorization from the database.

- [ ] **Step 1: Implement `getMemoDetail`**

Add to `lib/repo/memo.ts`. It calls `getMemoAccess` first and returns `null` when `canView` is false, so no caller can accidentally render an unauthorized memo.

```ts
export async function getMemoDetail(ctx: TenantContext, memoId: string) {
  const access = await getMemoAccess(ctx, memoId)
  if (!access?.canView) return null
  // …joins for memo, author, department, category, all cycles of steps with
  // assignee names, events with actor and on-behalf-of names, attachments
  // (without the `data` column), and versions (without body).
}
```

Never select `memoAttachments.data` here — the bytes go out only through the download route.

- [ ] **Step 2: Build `WorkflowRail`**

Props: `{ steps, currentCycle, currentStepNo, status }`. Renders the current cycle as an ordered rail, each step showing position title, assignee name and designation, outcome, actor (with "on behalf of" when set), timestamp and comment. Visual states: **done** (outcome approved/reviewed), **current** (emphasised, labelled with the required action and the responsible user), **future** (muted), **stopped** (rejected/skipped). Earlier cycles collapse into a "Previous rounds" disclosure. Vertical on mobile, horizontal from `md` up.

- [ ] **Step 3: Build `Timeline`**

Props: `{ events }`. One row per event: time, actor (with delegate attribution), a sentence describing the action, and the comment when present. Comment styling differs by event type so §8's four kinds are distinguishable — general comment, approval comment, rejection reason, change request.

- [ ] **Step 4: Build `ActionPanel`**

Rendered **only** when `access.canAct`. Buttons follow the step's `requiredAction`: Approve / Reject / Request changes for an approve step; Complete review / Reject / Request changes for a review step; Comment always. Reject and Request changes open a modal whose Submit is disabled until the comment is non-empty — and the server enforces the same rule regardless.

When `access.actingForUserId` is set, the panel is labelled "You are acting on behalf of {name}".

- [ ] **Step 5: Wire the Server Actions**

`app/(app)/memos/[id]/workflow-actions.ts`:

```ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/tenant'
import { actOnMemo, submitMemo, resubmitMemo, cancelMemo } from '@/lib/workflow'

const actionSchema = z.object({
  memoId: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'request_changes', 'comment', 'complete_review']),
  comment: z.string().max(5000).optional(),
})

export async function workflowAction(_prev: unknown, formData: FormData) {
  const ctx = await requireSession()
  const parsed = actionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'That action is not valid.' }
  const { memoId, action, comment } = parsed.data
  const result = await actOnMemo(ctx, memoId, action, comment ?? null)
  if (!result.ok) return { error: result.error }
  revalidatePath(`/memos/${memoId}`)
  revalidatePath('/inbox')
  return { ok: true as const }
}
```

The other three follow the same shape. Every one calls `requireSession()` — the engine re-checks authorization itself, so the UI is never the gate.

- [ ] **Step 6: Assemble the page**

`memos/[id]/page.tsx` calls `requireSession()`, then `getMemoDetail`; `notFound()` when it returns null. Layout: header (number, subject, status badge, priority badge, PDF export), a two-column body (memo content and attachments left; workflow rail right, moving above the content on mobile), then the action panel, then the timeline.

- [ ] **Step 7: Verify the §4 walkthrough by hand**

```bash
npm run dev
```

Run the exact §4 sequence across four logins: submit → Dept Head approves → Finance approves → Director requests changes → author resubmits → workflow continues → final approval. Expected: the rail and timeline match at each step, and a non-current participant sees no action panel.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: memo detail page with workflow rail, timeline and action panel"
```

---

### Task 9: Inbox, My Memos, Completed and Dashboard

**Files:**
- Create: `app/(app)/inbox/page.tsx`, `app/(app)/memos/page.tsx`, `app/(app)/completed/page.tsx`, `app/(app)/dashboard/page.tsx`
- Create: `app/(admin)/admin/page.tsx`
- Modify: `lib/repo/memo.ts`, create `lib/repo/stats.ts`

**Interfaces:**
- Produces: `listInbox(ctx, f)`, `listMyMemos(ctx, f)`, `listCompleted(ctx, f)` — each taking `f: { status?, priority?, categoryId?, departmentId?, sort?, page? }`; `lib/repo/stats.ts` exporting `userDashboard(ctx)` and `adminDashboard(ctx)`.

- [ ] **Step 1: Implement the list queries**

`listInbox` joins `workflowSteps` on `assigneeUserId IN (ctx.user.id, …activeDelegatorIds)` with `outcome = 'pending'`, `cycle = memos.currentCycle`, `stepNo = memos.currentStepNo`, and `memos.orgId = ctx.orgId`. Selected columns cover every §6.1 field: memo number, subject, author name, department name, priority, status, `submittedAt`, the step's `requiredAction`, and `lastActivityAt` for the age column.

`listMyMemos` filters `memos.authorId = ctx.user.id` and additionally returns the current participant's name (§6.2). `listCompleted` filters `status IN ('approved','rejected','cancelled')` and applies `canViewMemo`'s rule as a SQL predicate: author, or admin, or a participant in any cycle.

- [ ] **Step 2: Build the list pages**

A shared `MemoTable` with sortable headers and filter chips (status, priority, category, department). Age renders as "3d 4h pending" from `submittedAt`. Empty states name the reason ("Nothing is waiting on you").

- [ ] **Step 3: Implement `lib/repo/stats.ts`**

`userDashboard(ctx)` returns: `awaitingMyAction`, `submittedByMe`, `recentlyCompleted`, `pendingApprovals`, `pendingReviews`, `urgentMemos`, `recentActivity`, `countsByStatus` (§12).

`adminDashboard(ctx)` additionally returns: `userCount`, `activeUserCount`, `departmentCount`, `memoCount`, `pendingWorkflows`, `completedWorkflows`, `rejectedWorkflows`, `recentActivity` from `audit_log`.

- [ ] **Step 4: Build the dashboards**

`/dashboard` shows the counts as a stat row, then three lists (awaiting me, my memos, recently completed), an urgent memos strip, and recent activity. `/admin` shows the org-level stats and recent system activity.

- [ ] **Step 5: Verify and commit**

Log in as each fixture user and confirm the inbox shows a memo only to the user whose turn it is.

```bash
git add -A
git commit -m "feat: inbox, my memos, completed list and dashboards"
```

---

### Task 10: Notifications, search and audit log

**Files:**
- Create: `app/(app)/notifications/page.tsx` + `actions.ts`, `app/(app)/search/page.tsx`
- Create: `app/(admin)/admin/audit/page.tsx`
- Create: `lib/repo/notifications.ts`, `lib/repo/search.ts`, `lib/repo/audit.ts`
- Test: `tests/search.test.ts`

**Interfaces:**
- Produces: `listNotifications(ctx, opts)`, `unreadCount(ctx)`, `markRead(ctx, id)`, `markAllRead(ctx)`; `searchMemos(ctx, q)` where `q: { text?, memoNumber?, authorId?, departmentId?, categoryId?, status?, priority?, from?, to?, page? }`; `listAudit(ctx, f)`.

- [ ] **Step 1: Write the failing search isolation test**

Create `tests/search.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { resetDb } from './helpers/db'
import { makeOrgFixture, type OrgFixture } from './helpers/fixtures'
import { searchMemos } from '@/lib/repo/search'
import { submitMemo } from '@/lib/workflow'

let f: OrgFixture
beforeEach(async () => { await resetDb(); f = await makeOrgFixture() })

describe('searchMemos', () => {
  it('finds the author\'s own memo by a body term', async () => {
    const r = await searchMemos(f.authorCtx, { text: 'oscilloscopes' })
    expect(r.rows.some((m) => m.id === f.memoId)).toBe(true)
  })

  it('finds a memo by its number', async () => {
    const r = await searchMemos(f.authorCtx, { memoNumber: 'NBU-2026-0001' })
    expect(r.rows).toHaveLength(1)
  })

  it('never returns a memo from another organization', async () => {
    const r = await searchMemos(f.otherOrgCtx, { text: 'oscilloscopes' })
    expect(r.rows).toHaveLength(0)
  })

  it('never returns a memo the user is not authorized to see', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    const r = await searchMemos(f.outsiderCtx, { text: 'oscilloscopes' })
    expect(r.rows).toHaveLength(0)
  })

  it('returns a memo to a workflow participant', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    const r = await searchMemos(f.directorCtx, { text: 'oscilloscopes' })
    expect(r.rows).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npm test -- tests/search.test.ts
```

Expected: FAIL — cannot resolve `@/lib/repo/search`.

- [ ] **Step 3: Implement `lib/repo/search.ts`**

Two conditions are always present and never optional: `memos.orgId = ctx.orgId`, and the visibility predicate — author, or `ctx.user.role = 'org_admin'`, or an `EXISTS` against `workflow_steps` for the caller and their active delegators. Text search uses `to_tsvector('english', subject || ' ' || body_html) @@ plainto_tsquery('english', $text)`, matching the GIN index from Task 1. Every parameter is bound, never interpolated.

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm test -- tests/search.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Build the notification interface**

Bell in the shell with an unread count; `/notifications` lists them newest first with unread ones visually distinct, each linking to its memo. Actions: mark one read, mark all read — both scoped by `and(eq(notifications.id, id), eq(notifications.userId, ctx.user.id))`.

- [ ] **Step 6: Build the search page**

A filter bar covering all nine §11 criteria, results in the shared `MemoTable`, filters preserved in the query string.

- [ ] **Step 7: Build the audit log page**

Admin-only, filterable by event type, actor and date range, paginated. Read-only — there is no mutation path in the UI or in any action.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: notifications, search and audit log"
```

---

### Task 11: Workflow templates, delegation and versioning

**Files:**
- Create: `app/(admin)/admin/templates/page.tsx` + `actions.ts`
- Create: `app/(app)/delegations/page.tsx` + `actions.ts`
- Create: `app/(app)/memos/[id]/versions/page.tsx`
- Modify: `components/memo/participant-picker.tsx` (template prefill)

**Interfaces:**
- Produces: `createTemplate`, `updateTemplate`, `setTemplateActive`, `getTemplateSteps(ctx, id)`; `createDelegation`, `revokeDelegation`, `listMyDelegations(ctx)`; `listVersions(ctx, memoId)`, `getVersion(ctx, memoId, versionNo)`.

- [ ] **Step 1: Build template management**

Admin-only. A template is a name plus an ordered list of `{ positionTitle, requiredAction }`. Reordering rewrites `stepNo` for the whole template inside one transaction so no duplicate `(templateId, stepNo)` can exist.

- [ ] **Step 2: Wire templates into memo creation**

Selecting a template in the participant picker prefills the position rows; the author then assigns a real user to each. The author may also add, remove or reorder rows, giving §15's custom per-memo workflow.

- [ ] **Step 3: Build delegation**

`/delegations` lets a user create a delegation (delegate, start, end, reason), see incoming and outgoing delegations, and revoke their own. `createDelegation` validates: the delegate is an active user of `ctx.orgId`, the delegate is not the delegator, and `endAt > startAt`. The workflow engine already honours active delegations through `activeDelegatorIds`.

- [ ] **Step 4: Build the versions page**

Lists every version with number, editor, timestamp and the submission it belongs to; each opens the stored subject and body read-only. Visible to anyone with `canView`. Nothing on this page can modify a version — §17's "must not silently overwrite".

- [ ] **Step 5: Verify and commit**

Create a delegation, log in as the delegate, act on a memo, and confirm the timeline reads "acted on behalf of".

```bash
git add -A
git commit -m "feat: workflow templates, delegation and memo versioning"
```

---

### Task 12: Reporting and PDF export

**Files:**
- Create: `app/(admin)/admin/reports/page.tsx`, `lib/repo/reports.ts`
- Create: `lib/pdf.ts`, `app/api/memos/[id]/pdf/route.ts`

**Interfaces:**
- Produces: `memoReport(ctx, f: { from?, to?, departmentId?, categoryId?, status? })` returning `{ byStatus, byDepartment, byCategory, urgentCount, avgCompletionHours, pendingApprovals, rejectedCount, changeRequestCount }`; `buildMemoPdf(detail): Promise<Uint8Array>`.

- [ ] **Step 1: Implement `lib/repo/reports.ts`**

All aggregates are single grouped queries scoped by `ctx.orgId` with the filter applied uniformly. Average completion time:

```sql
AVG(EXTRACT(EPOCH FROM (completed_at - submitted_at)) / 3600)
  FILTER (WHERE status = 'approved' AND completed_at IS NOT NULL)
```

- [ ] **Step 2: Build the reports page**

Admin-only. Date range, department, category and status filters across the top; the eight §19 figures below as stat cards plus three breakdown tables. Numbers link through to a filtered search.

- [ ] **Step 3: Implement `lib/pdf.ts`**

`pdf-lib` with `StandardFonts.Helvetica` / `HelveticaBold`, A4 pages, a word-wrap helper, and automatic page breaks. Sections in order: organization name, code and contact block; a status stamp reading **APPROVED**, **REJECTED**, **CANCELLED** or **IN PROGRESS**; memo number, subject, author, department, category, priority, dates; the body via `htmlToText`; attachment references (filename, size, uploader, timestamp — never the bytes); the workflow participant sequence; the approval history with actor, action, timestamp and comment, including delegate attribution; and the comment thread.

- [ ] **Step 4: Build the export route**

`app/api/memos/[id]/pdf/route.ts` mirrors the attachment route exactly: `getSession()`, then `getMemoDetail(ctx, id)`, and `404` when it is null. On success it returns the bytes with `Content-Type: application/pdf` and a `Content-Disposition` filename of `${memoNumber}.pdf`.

- [ ] **Step 5: Verify and commit**

Export an approved memo, a rejected one and one in progress. Expected: each opens, and the status stamp is correct in all three.

```bash
git add -A
git commit -m "feat: administrative reports and memo PDF export"
```

---

### Task 13: Seed data and the full isolation suite

**Files:**
- Create: `db/seed.ts`
- Test: `tests/isolation.test.ts`

**Interfaces:**
- Produces: `npm run seed`, idempotent — it wipes and rebuilds the two demo organizations.

- [ ] **Step 1: Write the seed script**

Two organizations. **Northbridge University** (`NBU`) with departments Administration, Finance, Procurement, Computer Science, Human Resources; the seven starter categories; the three starter templates; and eight users — an admin plus an author, department head, finance manager, director, HR officer, procurement officer and one delegate. **Aurora Logistics** (`AUR`) with its own departments, categories and six users, none of whose data overlaps.

Northbridge gets memos in every status: a draft, one at step 1, one at step 2 with an approval recorded, one in `changes_requested` with two versions, one rejected with a reason, one fully approved with a complete history, one cancelled, and one urgent memo pending. Each carries realistic comments and at least one attachment.

Every seeded password is read from `SEED_PASSWORD` with a documented default of `Password123!`, and the script prints the credential table at the end. Real secrets never enter the repository.

- [ ] **Step 2: Run it**

```bash
npm run seed
```

Expected: the credential table prints and `/dashboard` shows populated data after logging in.

- [ ] **Step 3: Write the full isolation test**

Create `tests/isolation.test.ts` asserting that a user of organization B receives not-found — never a partial result and never a 403 — from every read path: `getMemoDetail`, `getMemoAccess`, `listInbox`, `listMyMemos`, `listCompleted`, `searchMemos`, `listNotifications`, `listAudit`, `listDepartments`, `listUsers`, `listCategories`, `listTemplates`, `listVersions`, `memoReport`, and both binary routes. Also assert that `actOnMemo`, `submitMemo`, `resubmitMemo` and `cancelMemo` all fail for a cross-org actor.

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { resetDb } from './helpers/db'
import { makeOrgFixture, type OrgFixture } from './helpers/fixtures'
import { getMemoDetail, listInbox, listMyMemos, listCompleted } from '@/lib/repo/memo'
import { searchMemos } from '@/lib/repo/search'
import { listDepartments, listUsers, listCategories, listTemplates } from '@/lib/repo/org'
import { getMemoAccess } from '@/lib/authz'
import { submitMemo, actOnMemo, resubmitMemo, cancelMemo } from '@/lib/workflow'

let f: OrgFixture
beforeEach(async () => { await resetDb(); f = await makeOrgFixture() })

describe('cross-tenant reads', () => {
  it('every memo read path returns nothing for the other organization', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    expect(await getMemoDetail(f.otherOrgCtx, f.memoId)).toBeNull()
    expect(await getMemoAccess(f.otherOrgCtx, f.memoId)).toBeNull()
    expect((await listInbox(f.otherOrgCtx, {})).rows).toHaveLength(0)
    expect((await listMyMemos(f.otherOrgCtx, {})).rows).toHaveLength(0)
    expect((await listCompleted(f.otherOrgCtx, {})).rows).toHaveLength(0)
    expect((await searchMemos(f.otherOrgCtx, { text: 'oscilloscopes' })).rows).toHaveLength(0)
  })

  it('every org read path is scoped', async () => {
    expect((await listDepartments(f.otherOrgCtx)).some((d) => d.name === 'Finance')).toBe(false)
    expect((await listUsers(f.otherOrgCtx)).some((u) => u.email === 'ayesha@nbu.test')).toBe(false)
    expect((await listCategories(f.otherOrgCtx)).every((c) => c.orgId === f.otherOrgCtx.orgId)).toBe(true)
    expect((await listTemplates(f.otherOrgCtx)).every((t) => t.orgId === f.otherOrgCtx.orgId)).toBe(true)
  })
})

describe('cross-tenant writes', () => {
  it('every workflow mutation fails for the other organization', async () => {
    expect((await submitMemo(f.otherOrgCtx, f.memoId)).ok).toBe(false)
    await submitMemo(f.authorCtx, f.memoId)
    expect((await actOnMemo(f.otherOrgCtx, f.memoId, 'approve', null)).ok).toBe(false)
    expect((await resubmitMemo(f.otherOrgCtx, f.memoId, 'resume')).ok).toBe(false)
    expect((await cancelMemo(f.otherOrgCtx, f.memoId, 'x')).ok).toBe(false)
  })
})
```

- [ ] **Step 4: Run the whole suite**

```bash
npm test
```

Expected: every suite passes. Then:

```bash
npx tsc --noEmit && npm run build
```

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: demo seed data and full tenant isolation suite"
```

---

### Task 14: Documentation and deployment

**Files:**
- Create: `README.md`, `docs/PROJECT_DOCUMENTATION.md`, `SUBMISSION.md`
- Modify: `.env.example`

- [ ] **Step 1: Write `README.md`**

The ten §25 items as numbered sections: required software and versions (Node 22+, npm 10+, Docker or a Neon account), `npm install`, environment variables with `.env.example` explained line by line, database configuration (`docker compose up -d`), initialization (`npm run db:migrate`), demo data (`npm run seed`), local start (`npm run dev`), production build (`npm run build && npm start`), external services (none beyond Postgres), and the extra configuration needed to reproduce the deployment.

- [ ] **Step 2: Write `docs/PROJECT_DOCUMENTATION.md`**

The §26 sections in order: system overview; requirements implemented, as a table mapping each spec section §1–§22 to the files that implement it; technology stack with versions; system architecture; database design with the table list and relationships; workflow design including the state machine and both resubmit modes; security, following the §21 mapping table from the spec; the AI-assisted development process; known limitations; and deployment information.

- [ ] **Step 3: Deploy to Neon and Vercel**

Give the user these steps to run, since both require their login:

```bash
# 1. Create a Neon project at https://console.neon.tech and copy the POOLED
#    connection string (it contains "-pooler"). Then, locally:
DATABASE_URL="<neon-pooled-url>" npx drizzle-kit migrate
DATABASE_URL="<neon-pooled-url>" npm run seed
```

```bash
# 2. Push the repository to GitHub, then import it at https://vercel.com/new
#    and set one environment variable: DATABASE_URL = <neon-pooled-url>
git remote add origin <your-github-url>
git push -u origin main
```

Vercel builds with `npm run build` and serves over HTTPS automatically (§21.14).

- [ ] **Step 4: Verify the deployment against the §28 demonstration scenario**

Walk all fourteen §28 steps on the deployed URL, finishing with step 14: log in as an Aurora Logistics user and request a Northbridge memo URL directly. Expected: not-found.

- [ ] **Step 5: Write `SUBMISSION.md`**

The deployed URL, the demo credentials for both organizations including an administrator account, and the §28 walkthrough written as a script an evaluator can follow. No production secrets.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: installation guide, project documentation and submission notes"
```

---

## Self-Review

**Spec coverage.** §2.1 → Tasks 4, 5. §2.2 → Task 4. §2.3 → Tasks 2, 5, 7. §3.1–3.2 → Task 6. §4 → Tasks 7, 8. §5 → Task 1 (`MEMO_STATUSES`), Task 7. §6 → Task 9. §7 → Task 8. §8 → Tasks 7, 8 (`memo_events`). §9 → Task 6. §10 → Tasks 7, 10. §11 → Task 10. §12 → Task 9. §13, §14 → Task 5. §15 → Task 11. §16 → Tasks 7, 11. §17 → Tasks 7, 11. §18 → Tasks 4, 10. §19 → Task 12. §20 → Task 12. §21 → Tasks 2, 6, 7, 13 (verified by `tests/isolation.test.ts`). §22 → Tasks 3, 4, 5, 8, 9, 10. §23–§29 → Tasks 13, 14.

**Placeholders.** None: every code step carries the code, every command carries its expected output.

**Type consistency.** `TenantContext` is `{ orgId, user }` in every task. `ActResult` is the discriminated union from Task 7 in Tasks 7, 8 and 11. `MemoAccess` field names (`canView`, `canAct`, `canEdit`, `canCancel`, `actingForUserId`) are identical in Tasks 6, 7, 8 and 13. `getMemoAccess(ctx, memoId, ex?)` takes a memo **id**, matching every call site. Repository functions take `ctx` first, without exception.
