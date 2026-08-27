# Inter-Office Memo Management System — Design

**Date:** 2026-08-27
**Source requirements:** `Project_3_PRD.md` (CSE226.1 Project 3, §1–§31)
**Submission deadline:** midnight, 29 August 2026

## 1. Purpose and scope

A deployed, multi-tenant web application for managing internal office memos and their sequential review/approval workflows. Multiple organizations share one deployment while their users, memos, attachments, workflows and activity remain strictly isolated.

Scope is the full specification, §1–§22, including the optional-sounding "should" clauses: workflow templates (§15), delegation (§16), memo versioning (§17), audit log (§18), reporting (§19) and PDF export (§20). Plus the submission deliverables of §23–§29.

Out of scope: outbound email, real-time push (websockets), org-to-org federation, mobile native apps, SSO, file preview/thumbnailing.

## 2. Technology decisions

| Concern | Decision | Rationale |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | One codebase, server-rendered pages plus Server Actions, one deploy |
| Runtime | Node (not Edge) on all routes | bcrypt and pdf-lib require Node APIs |
| Styling | Tailwind CSS v4 (CSS-first config) | Same as the author's previous project; no `tailwind.config.js` |
| Database | Neon Postgres (serverless, free tier) | Managed HTTPS-reachable Postgres, no ops |
| DB access | Drizzle ORM + `postgres` (postgres-js) driver over Neon's pooled connection with `prepare: false` | Typed SQL, real transactions — the HTTP driver cannot do transactions, and the workflow engine needs `FOR UPDATE` |
| Migrations | drizzle-kit generated SQL, committed to the repo | §24 requires schema/migrations in the archive |
| Auth | Hand-rolled: bcryptjs hashes + DB-backed sessions | Full control, demonstrable, no framework magic to explain in §26.7 |
| Rich text | Tiptap (StarterKit) in the editor, `sanitize-html` on the server at save time | §3.1 requires basic rich text; stored HTML must be sanitized or it is stored XSS |
| Attachments | Bytes in Postgres (`bytea`), served through an authorized route handler | Vercel has no persistent disk; keeps §9's "no URL guessing" airtight |
| PDF export | `pdf-lib` with standard fonts | Headless Chrome will not run on Vercel's free tier |
| Tests | Vitest against a Docker Postgres 16 | Covers the logic whose bugs are invisible in a demo |
| Hosting | Vercel (app) + Neon (database) | Free tier, HTTPS by default (§21.14) |

### Rejected alternatives

- **FastAPI + React/Vite** (the author's familiar stack): two services, CORS and session configuration across origins, two deployments. More setup risk inside a two-day window.
- **Django + HTMX**: fastest backend, but templating constrains the visual polish that §22 calls for.
- **Vercel Blob for attachments**: another service and token; bytea is sufficient at demo scale (Neon free tier is 0.5 GB against a 4 MB per-file cap).

## 3. Architecture

```
app/
  (auth)/    login · register-organization · forgot-password · reset-password/[token]
  (app)/     dashboard · inbox · memos · memos/new · memos/[id] · memos/[id]/edit
             memos/[id]/versions · completed · search · notifications · profile · delegations
  (admin)/   admin · admin/organization · admin/users · admin/departments
             admin/categories · admin/templates · admin/reports · admin/audit
  api/attachments/[id]/route.ts     authorized binary download
  api/memos/[id]/pdf/route.ts       authorized PDF export
lib/
  auth.ts     password hashing, session issue/verify/revoke, reset tokens
  tenant.ts   TenantContext construction — the only source of org scope
  authz.ts    canViewMemo, canActOnMemo, requireAdmin, delegation resolution
  workflow.ts the workflow state machine (see §5)
  notify.ts   notification creation fan-out
  audit.ts    audit_log append
  pdf.ts      memo -> PDF document
db/
  schema.ts · migrations/ · seed.ts
components/  design system primitives + WorkflowRail, Timeline, MemoCard, StatusBadge…
```

**Read path:** server components call repository functions directly. **Write path:** Server Actions. Nothing fetches tenant data from the client, so no client route can bypass a check.

### Tenant isolation

Isolation is structural rather than a filter each query is trusted to remember:

1. Every tenant-owned table carries a non-null `org_id`.
2. Repository functions take a `TenantContext` as their first parameter.
3. `TenantContext` is constructible **only** from a validated session inside `lib/tenant.ts`. No exported function accepts a caller-supplied `orgId`.
4. Every `WHERE` clause includes `org_id = ctx.orgId`.
5. A row belonging to another organization therefore returns *not found*, never a 403 — the response does not confirm that the identifier exists.

Middleware performs only a cookie-presence redirect. Every authorization fact is re-derived from the database on each request; a stale or forged cookie yields no session.

## 4. Data model

All tenant tables carry `id uuid pk`, `org_id uuid not null references organizations`, `created_at timestamptz not null default now()`. Timestamps are stored UTC, tz-aware.

- **organizations** — name, slug (unique), identifier/code, logo bytes + mime, contact email/phone/address, `config jsonb` (memo number prefix and format), created_at.
- **departments** — name, description, `active boolean`. Never hard-deleted (§13: deactivation must not destroy historical memo information).
- **users** — name, email (unique per org), designation, `department_id`, `role` (`org_admin` | `user`), `status` (`active` | `inactive`), `password_hash`, last_login_at.
- **sessions** — `token_hash`, user, expires_at, created_at, user_agent. Rotated on login, deleted on logout, deleted for a user on deactivation.
- **password_reset_tokens** — `token_hash`, user, expires_at, used_at.
- **memo_categories** — name, description, `active` (§14).
- **workflow_templates** — name, description, `active`; **workflow_template_steps** — template, `step_no`, `position_title`, `required_action` (`approve` | `review`) (§15).
- **memos** — `memo_number` (unique per org), subject, `body_html`, author, department, category, `priority` (`normal` | `high` | `urgent`), `status`, `current_cycle`, `current_step_no`, `current_version`, template_id, submitted_at, completed_at, final_approver_id, cancelled_at, updated_at.
- **memo_versions** — memo, `version_no`, subject, body_html, editor, created_at, submitted_at. Full content snapshot per submission round (§17).
- **memo_attachments** — memo, filename, mime, `size_bytes`, `data bytea`, uploaded_by, uploaded_at, version_no.
- **workflow_steps** — memo, `cycle`, `step_no`, position_title, `assignee_user_id`, `required_action`, `outcome` (`pending` | `approved` | `rejected` | `changes_requested` | `reviewed` | `skipped`), `acted_by_user_id`, `on_behalf_of_user_id`, acted_at, comment.
- **memo_events** — append-only: memo, `type` (`created`, `submitted`, `approved`, `rejected`, `changes_requested`, `comment`, `forwarded`, `completed`, `cancelled`, `attachment_added`, `attachment_deleted`, `version_created`, `resubmitted`, `participant_assigned`), actor, on_behalf_of, cycle, step_no, `comment text`, created_at.
- **notifications** — user, `type`, memo, title, body, `read_at` (§10).
- **audit_log** — org, actor, `event_type`, `entity_type`, `entity_id`, description, ip, created_at (§18).
- **delegations** — delegator, delegate, start_at, end_at, reason, `status` (`active` | `revoked` | `expired`) (§16).

### One append-only log for three views

The §7 timeline, the §8 comment thread and the §4.1 approval history are all rendered from `memo_events`. The application issues no UPDATE or DELETE against that table, so §8's "ordinary users cannot silently modify or delete historical workflow comments" holds as a property of the schema rather than a permission check that could be missed. The event `type` distinguishes §8's four required comment kinds — general comment, approval comment, rejection reason, change request — so they render distinctly without extra columns.

`audit_log` stays separate: it is org-wide and covers non-memo events (login, logout, user creation, activation) that §18 requires alongside the memo events.

## 5. Workflow engine (`lib/workflow.ts`)

Every workflow action executes inside a single transaction that opens with:

```sql
SELECT * FROM memos WHERE id = $1 AND org_id = $2 FOR UPDATE
```

The row lock makes concurrent actions serialize, so two participants clicking Approve simultaneously cannot both succeed and steps cannot execute out of order.

Each action then asserts, on the server, in order:

1. the memo is in a status that accepts workflow action;
2. the actor is the assignee of the **current** step, or an active delegate of that assignee;
3. the requested action is legal for that step's `required_action`;
4. required comments are present.

Only then does it mutate. `Approve` on step 3 while step 2 is pending fails at assertion (2) no matter what the client sent (§4.2).

### Actions (§4.1)

- **Approve** — marks the step `approved`. If it was the final step: status `approved`, `final_approver_id` and `completed_at` recorded, author and all participants notified (§4.3). Otherwise the current step advances and the next assignee is notified.
- **Reject** — comment **required** (§4.1). Status `rejected`; remaining steps in the cycle marked `skipped`; author and prior participants notified. Workflow terminates (§4.4).
- **Request changes** — comment **required**. Status `changes_requested`; the memo returns to the author and becomes editable; author notified (§4.4).
- **Comment** — available to the author and any participant at any time; never advances the workflow.
- **Complete review** — for steps whose `required_action` is `review`; advances like approve but records outcome `reviewed`.
- **Cancel** — author or org admin, while in progress. Status `cancelled`.

### Submit and resubmit

`submit` requires at least one workflow step, snapshots version 1, creates the `cycle 1` step rows, sets the status from step 1's required action (`pending_review` or `pending_approval`), notifies the first assignee, and writes the submission event (§3.2).

`resubmit` (author only, from `changes_requested`) snapshots a new version and opens a new cycle. §4's worked example is ambiguous about where the workflow resumes, so the author chooses at resubmit time:

- **Resume at the participant who requested changes** (default) — matches the §4 walkthrough, where the workflow "continues" after the author revises.
- **Restart from the first participant** — appropriate when the content changed materially enough that earlier approvals no longer stand.

Both choices are recorded in the timeline, and all prior cycles remain visible (§4.4: "preserve the history of previous submissions and decisions").

### Terminal states

`approved`, `rejected` and `cancelled` memos are read-only to all users. Only the audit and version views remain accessible (§4.3).

### Statuses (§5)

`draft` · `submitted` · `pending_review` · `pending_approval` · `changes_requested` · `rejected` · `approved` · `cancelled`

## 6. Authorization (`lib/authz.ts`)

- `requireSession()` — validated session or redirect to login. Rejects sessions whose user is `inactive`.
- `requireAdmin()` — additionally requires `role = org_admin`.
- `canViewMemo(ctx, memo)` — author, **or** a participant in any cycle, **or** an org admin. Always within the same organization, which the TenantContext already guarantees.
- `canActOnMemo(ctx, memo)` — assignee of the current step, or a delegate holding an active delegation from that assignee.
- Attachments (`/api/attachments/[id]`) and PDF export (`/api/memos/[id]/pdf`) run `canViewMemo` before returning bytes. A valid identifier for a memo the caller cannot see returns 404 (§9, §21.5, §21.12).

Delegated actions record both `acted_by_user_id` and `on_behalf_of_user_id`, and every surface renders them as "Delegate Name (on behalf of Principal Name)" (§16).

Hiding a UI control is never the authorization mechanism; each Server Action re-checks independently (§2.3).

## 7. Feature surfaces

- **Dashboard** (§12) — awaiting my action, submitted by me, recently completed, pending approvals, pending reviews, urgent memos, recent activity, counts by status. Admins additionally get user/department/memo counts and pending, completed and rejected workflow totals.
- **Inbox** (§6.1) — memos awaiting this user's action, showing number, subject, sender, department, priority, status, submitted date, required action and age pending; filterable and sortable.
- **My Memos** (§6.2) and **Completed** (§6.3).
- **Memo detail** (§7) — full memo, the workflow rail, the chronological timeline, comments, attachments, and the action panel when it is the viewer's turn.
- **Search** (§11) — number, subject, body, author, department, category, status, priority, date range. Postgres full-text over subject and body; always org-scoped and permission filtered.
- **Notifications** (§10) — in-app list with unread indicators, generated for: action required, approved, rejected, changes requested, comment added, resubmitted, workflow completed, workflow assignment.
- **Admin** (§2.1, §13, §14, §15, §18, §19) — organization profile, users (invite, activate/deactivate, assign role and department, generate a password reset link), departments, categories, workflow templates, reports, audit log.
- **Reports** (§19) — memos by status, by department, by category, urgent count, average workflow completion time, pending approvals, rejected count, change-request count; filterable by date range, department, category, status.
- **PDF export** (§20) — organization header, memo metadata, body, attachment references, workflow participants, approval history, comments, and a prominent final-status stamp.

## 8. Authentication flows (§2.2)

Login, logout, change password (requires the current password, revokes other sessions), forgot password (single-use hashed token, one-hour expiry, responding identically whether or not the address exists), reset password, view and edit profile.

There is no outbound email. The reset token is surfaced two ways: written to the server log, and generatable by an org admin from the user list — which is also the realistic administrative path for an internal system. §10 lists email as "may additionally support", so nothing required depends on it.

Organization registration is public: it creates the organization plus its first `org_admin` in one transaction, satisfying §28 demo step 1.

## 9. Interface

The visual system is produced with the `impeccable` skill. Direction: a document-grade administrative interface — quiet chrome, strong typographic hierarchy, a single accent colour, and one consistent token set for status so that priority and status never compete for the same visual channel.

The signature component is the **workflow rail** on the memo detail page: completed steps with their outcome and actor, the current step with the responsible user and the action required, and the future steps — legible at a glance and on a phone. This is §22's "current workflow state and required user action should be visually obvious", and it is the first thing an evaluator looks at.

Responsive from phone to desktop. Every page listed in §22 exists.

## 10. Security (§21) mapping

| Requirement | Mechanism |
|---|---|
| 1. Authenticate protected operations | `requireSession()` in every server action and protected page |
| 2. Server-side authorization | Authorization in Server Actions and route handlers; UI state is never the gate |
| 3–4. Tenant isolation | `TenantContext`; no query accepts a caller-supplied org id |
| 5. Unauthorized memo access | `canViewMemo` on every memo read path; not-found rather than forbidden |
| 6. Unauthorized workflow actions | Assignee assertion inside the `FOR UPDATE` transaction |
| 7. Password hashing | bcryptjs, cost 12 |
| 8. Credential and session protection | httpOnly + Secure + SameSite=Lax cookie; only a hash of the token is stored |
| 9. Input validation | Zod schema on every Server Action input |
| 10. Common web vulnerabilities | React escaping; `sanitize-html` allowlist on memo bodies; SameSite plus Server Action origin checks for CSRF |
| 11. Upload validation | Extension and MIME allowlist, 4 MB per file, 10 files per memo, filename sanitized |
| 12. Attachment access | Served only through the authorized route handler; bytes never publicly addressable |
| 13. Error messages | Generic user-facing errors; details to the server log only |
| 14. HTTPS | Vercel default |
| 15. Injection | Drizzle parameterized queries throughout; no string-built SQL |

## 11. Verification

Vitest against a Docker Postgres 16, focused where bugs are invisible in a demo:

- **Workflow state machine** — every action from every status, out-of-order approval rejected, both resubmit modes, rejection and change-request comment requirements, and the full §4 worked example end to end.
- **Tenant isolation** — a user of organization B attempting every read path against an organization A memo, attachment download and PDF export included.
- **Authorization** — non-assignee approve, deactivated user, expired delegation, terminal memo mutation, non-author editing a draft.

No browser end-to-end tests: low value here against the remaining time.

### Seed data

Two organizations — **Northbridge University** and **Aurora Logistics** — so cross-tenant denial is demonstrable on the deployed URL (§28 step 14). Each gets departments, categories, workflow templates, roughly eight users, and memos resting in every status, including one mid-workflow, one in `changes_requested` with two versions, one rejected and one approved with a full history.

## 12. Deliverables

- `README.md` — §25 installation and setup: required software and versions, dependency install, environment variables, database configuration and initialization, seeding, local start, production build, external services.
- `docs/PROJECT_DOCUMENTATION.md` — §26: overview, requirements implemented, technology stack, architecture, database design, workflow design, security, AI-assisted development process, known limitations, deployment information.
- `.env.example` — every variable, no secrets.
- `SUBMISSION.md` — deployed URL, demo credentials for both organizations including an administrator account, and the §28 demonstration script.
- Deployment steps for Vercel + Neon.

## 13. Build order

Core first, so a working demo exists at every point:

1. Scaffold, database schema, migrations, design tokens.
2. Auth, organization registration, sessions, tenant context.
3. Admin: departments, users, categories, organization profile.
4. Memo CRUD, drafts, rich text, attachments.
5. Workflow engine plus the memo detail page and workflow rail.
6. Inbox, my memos, completed, dashboard.
7. Notifications, search, audit log.
8. Workflow templates, delegation, versioning, reports, PDF export.
9. Seed data, tests, documentation, deployment.

## 14. Known limitations (carried into §26.9)

- No outbound email; password reset is by administrator-generated link or server log.
- Attachments live in the database, which does not scale past demo volumes.
- PDF export flattens rich-text formatting to structured text.
- Notifications are polled on navigation rather than pushed over a socket.
- One `org_admin` / `user` role pair; no custom per-permission roles.
