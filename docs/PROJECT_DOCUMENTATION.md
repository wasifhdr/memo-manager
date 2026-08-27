# Project Documentation — Inter-Office Memo Management System

CSE226.1 Project 3. This document follows the structure requested in
§26 of the specification (`Project_3_PRD.md`).

## 26.1 System Overview

Memo Manager is a multi-tenant web application for creating inter-office
memos and routing them through a defined, ordered sequence of reviewers and
approvers. Multiple organizations share one deployment while their users,
memos, attachments, workflows, and activity remain strictly isolated from
one another. A memo's lifecycle — draft, submission, sequential
review/approval, rejection or approval, and optional revise-and-resubmit
cycles — is enforced entirely on the server, with a complete, append-only
history of every action taken.

The design spec and implementation plan that preceded this build are at
[`docs/superpowers/specs/2026-08-27-memo-management-design.md`](superpowers/specs/2026-08-27-memo-management-design.md)
and
[`docs/superpowers/plans/2026-08-27-memo-management-system.md`](superpowers/plans/2026-08-27-memo-management-system.md).

## 26.2 Requirements Implemented

Every functional requirement in §1–§22 of the specification is implemented.

| Spec section | Implemented in |
|---|---|
| §2.1 Multi-tenant organization management | `lib/org-setup.ts`, `app/(admin)/admin/organization`, `app/(admin)/admin/departments` |
| §2.2 User authentication | `lib/auth.ts`, `app/(auth)/*` |
| §2.3 Roles and permissions | `db/schema.ts` (`role` enum), `lib/tenant.ts` (`requireSession`/`requireAdmin`), enforced again inside every Server Action |
| §3 Memo creation, drafts | `app/(app)/memos/new`, `app/(app)/memos/[id]/edit`, `lib/sanitize.ts` |
| §4 Memo workflow (sequence, actions, completion, rejection/changes) | `lib/workflow.ts`, tested exhaustively in `tests/workflow.test.ts` |
| §5 Memo status | `MEMO_STATUSES` in `db/schema.ts` |
| §6 Inbox / My Memos / Completed | `lib/repo/memo.ts` (`listInbox`, `listMyMemos`, `listCompleted`), corresponding pages |
| §7 Memo details and timeline | `app/(app)/memos/[id]`, `components/memo/timeline.tsx`, `components/memo/workflow-rail.tsx` |
| §8 Comments and discussion | `memo_events` (append-only), rendered by `Timeline` |
| §9 Attachments | `app/api/attachments/[id]/route.ts`, gated by `lib/authz.ts` |
| §10 Notifications | `lib/notify.ts`, `app/(app)/notifications` |
| §11 Search and filtering | `lib/repo/search.ts`, `app/(app)/search` |
| §12 Dashboard | `lib/repo/stats.ts`, `app/(app)/dashboard`, `app/(admin)/admin` |
| §13 Departments | `app/(admin)/admin/departments` — deactivation only, never deletion |
| §14 Memo categories | `app/(admin)/admin/categories` |
| §15 Workflow templates | `app/(admin)/admin/templates`, `components/memo/participant-picker.tsx` |
| §16 Delegation | `app/(app)/delegations`, honored inside `lib/workflow.ts` and `lib/authz.ts` |
| §17 Memo versioning | `memo_versions`, `app/(app)/memos/[id]/versions` |
| §18 Audit log | `audit_log`, `app/(admin)/admin/audit` |
| §19 Reporting | `lib/repo/reports.ts`, `app/(admin)/admin/reports` |
| §20 PDF export | `lib/pdf.ts`, `app/api/memos/[id]/pdf/route.ts` |
| §21 Security | see §26.7 below |
| §22 User interface | every listed page exists; responsive from phone to desktop |

## 26.3 Technology Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript), Node runtime everywhere |
| Styling | Tailwind CSS v4 (CSS-first, no `tailwind.config.js`) |
| Database | PostgreSQL 16 (local: Docker; production: Neon serverless) |
| ORM | Drizzle ORM + `postgres-js` driver |
| Authentication | Hand-rolled — bcryptjs password hashes, database-backed sessions, httpOnly cookies |
| Validation | Zod on every Server Action input |
| Rich text | Tiptap (StarterKit), sanitized server-side with `sanitize-html` |
| PDF generation | `pdf-lib` |
| Testing | Vitest against a disposable Postgres database |
| Hosting | Vercel (application) + Neon (database) |

## 26.4 System Architecture

Server components read directly from tenant-scoped repository functions
(`lib/repo/*.ts`); all writes go through Server Actions, which validate
input, re-derive authorization from the database, and call the domain
modules in `lib/` (`workflow.ts`, `authz.ts`, `auth.ts`, `notify.ts`,
`audit.ts`, `pdf.ts`). Nothing on the client ever receives tenant data
without that path.

**Tenant isolation is structural.** Every tenant-owned table carries a
non-null `org_id`. Every repository function takes a `TenantContext` — an
object constructible *only* from a validated session, in `lib/tenant.ts` —
as its first parameter, and every query filters by `ctx.orgId`. No exported
function anywhere accepts a caller-supplied organization id. A row belonging
to another organization is therefore indistinguishable from a row that does
not exist: every such read returns `null`/an empty list, never a 403 that
would confirm the row's existence. This is verified directly by
`tests/isolation.test.ts`, which drives every read and write path from a
second organization's session and asserts nothing leaks and nothing
succeeds.

Binary content (attachments, the organization logo) is served through
dedicated route handlers (`app/api/attachments/[id]`, `app/api/org-logo`)
that run the same authorization check as the rest of the app before
returning bytes — an attachment id is never a bearer token.

## 26.5 Database Design

Seventeen tables, defined in `db/schema.ts`; the committed SQL migration is
`db/migrations/0000_sweet_iceman.sql`.

- `organizations`, `departments`, `users`, `sessions`,
  `password_reset_tokens` — tenancy and authentication.
- `memo_categories`, `workflow_templates`, `workflow_template_steps` —
  per-organization configuration.
- `memos`, `memo_versions`, `memo_attachments`, `workflow_steps`,
  `memo_events`, `memo_counters` — the memo and its workflow.
- `notifications`, `audit_log`, `delegations` — cross-cutting concerns.

Two design decisions worth calling out:

1. **`memo_events` is the single append-only source for three views** — the
   §7 timeline, the §8 comment thread, and the §4.1 approval history. The
   application contains no `UPDATE` or `DELETE` against this table, so "a
   user cannot silently modify historical comments" is a property of the
   schema rather than a permission check that could be missed.
2. **`workflow_steps` carries a `cycle` number.** Each submission or
   resubmission opens a new cycle; every prior cycle's rows are kept, giving
   the complete multi-round history required by §4.4 and §17 without ever
   overwriting a row.

Attachments and the organization logo are stored as `bytea` columns rather
than on a filesystem, since the hosting platform (Vercel) has no persistent
disk; see the Known Limitations section for the scaling trade-off this
implies.

## 26.6 Workflow Design

The engine (`lib/workflow.ts`) exposes four actions — `submitMemo`,
`actOnMemo` (approve / reject / request changes / comment / complete
review), `resubmitMemo`, `cancelMemo` — each running inside one database
transaction that opens with `SELECT … FOR UPDATE` on the memo row, so
concurrent actions on the same memo serialize rather than race.

Each decision action asserts, in order: the memo is in an actionable state;
the current step's outcome is still `pending` (a step that already recorded
a decision — most commonly one that requested changes — cannot be decided
again); the caller is that step's assignee or an active delegate of theirs;
the action matches the step's required action (`approve` vs. `review`).
Comments are available to the author and any participant of the current
cycle at any time, independent of whose turn it is, and never advance the
workflow.

**Resubmission** is deliberately a choice, since the spec's worked example
does not pin one interpretation: the author picks between resuming at the
participant who requested changes (matching the §4 example, where the
workflow "continues") or restarting from the first participant, for changes
substantial enough that earlier approvals should not stand. Either way, a
new version and a new cycle are created; nothing from the previous round is
overwritten.

This engine was tested with the full §4 worked example (submit → approve →
approve → request changes → resubmit → approve → approve → approve →
approved) end to end, both as an automated test and as a manual walkthrough
across four separate logins during development.

## 26.7 Security

Mapped directly against §21:

| # | Requirement | Mechanism |
|---|---|---|
| 1 | Authenticate protected operations | `requireSession()` in every protected page and Server Action |
| 2 | Server-side authorization | Every Server Action and route handler re-checks; the UI never gates |
| 3–4 | Tenant isolation | `TenantContext`; no function accepts a caller-supplied org id (§26.4) |
| 5 | Unauthorized memo access | `canViewMemo`/`getMemoAccess` on every read path; not-found, not forbidden |
| 6 | Unauthorized workflow actions | Assignee + step-outcome assertions inside the locked transaction |
| 7 | Password hashing | bcryptjs, cost 12 |
| 8 | Credential/session protection | httpOnly, Secure (in production), SameSite=Lax cookie; only a SHA-256 hash of the session token is stored |
| 9 | Input validation | Zod schema on every Server Action |
| 10 | Common web vulnerabilities | React's automatic escaping; `sanitize-html` allowlist on memo bodies; SameSite plus same-origin Server Actions for CSRF |
| 11 | Upload validation | MIME + extension allowlist, 4 MB/file, 10 files/memo, filename sanitized |
| 12 | Attachment access | Served only through an authorized route handler; never a directly guessable public URL |
| 13 | Error messages | Generic user-facing messages (e.g. login never reveals which accounts exist); details go to the server log only |
| 14 | HTTPS | Provided by Vercel in production |
| 15 | Injection | Drizzle's parameterized query builder throughout; no interpolated SQL strings |

## 26.8 Vibe-Coding / AI-Assisted Development Process

This system was built with Claude Code (Claude Opus 5) in a single extended
session, following a structured process: a written design spec and
implementation plan were produced and reviewed before any code was written,
then all fourteen implementation tasks were executed in order, each with
its own tests written first, a working verification pass (automated tests
plus, where feasible, a live walkthrough in a running browser), and a git
commit.

Two genuine bugs were found and fixed during that verification, both
documented in their commit messages:

- Raw `tx.execute(sql...)` calls issued inside a Drizzle `db.transaction()`
  intermittently failed to see rows committed immediately before the
  transaction opened. Replaced with the query builder's `.for('update')` and
  `onConflictDoUpdate()`, which are unaffected.
- After a `request_changes` decision, `currentStepNo` deliberately stays
  pointed at that step until the author resubmits, but the engine did not
  check the step's own outcome before allowing another decision — the same
  assignee could approve a step that had already requested changes. Fixed
  by requiring the current step's outcome to still be `pending`, in both
  the workflow engine and `getMemoAccess`, with a regression test added for
  each.

The complete prompt and response history for this session is submitted per
§27 — see the AI Prompt/Response History link in `SUBMISSION.md`.

## 26.9 Known Limitations

- **No outbound email.** Password reset issues a single-use link that is
  written to the server log and can also be generated on demand by an
  organization administrator from the user list. §10 lists email as
  optional ("may additionally support"); everything required is delivered
  through in-app notifications.
- **Attachments and the organization logo are stored as database bytes**,
  not on a filesystem or object store, because the hosting platform has no
  persistent disk. This is capped (4 MB/file, 10 files/memo, 512 KB logo)
  and adequate for demonstration but would not scale to a large production
  deployment without moving to object storage.
- **PDF export flattens rich-text formatting** (bold, lists, headings) to
  structured plain text, since a full HTML-to-PDF layout engine (a headless
  browser) is not available on the hosting platform's free tier.
- **Notifications are read on navigation**, not pushed live over a socket;
  the unread count updates on the next page load.
- **Two roles only** (`org_admin`, `user`) — no custom per-permission role
  system.

## 26.10 Deployment Information

- **Platform:** Vercel (application), Neon (Postgres).
- **Configuration:** one environment variable, `DATABASE_URL`, set to Neon's
  pooled connection string. No other secret or third-party service is
  required.
- **Build command:** `npm run build` (Vercel's default for a Next.js
  project). **Database migration/seed:** run manually against the target
  database before or after the first deploy — see `README.md` §5–§6.
- Deployed URL and demonstration credentials: `SUBMISSION.md`.
