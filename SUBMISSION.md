# Submission

## A. Deployed Application

**URL:** https://memo-manager.vercel.app/

## B. Project Documentation

[`docs/PROJECT_DOCUMENTATION.md`](docs/PROJECT_DOCUMENTATION.md)

## C. Source Code

A link to a ZIP of this repository. **URL:** _[fill in]_

## D. AI Prompt and Response History

**URL:** _[fill in — export this conversation and link it here; see §27 of the
spec for what must be included. Never include the redacted output of any
password or key you paste while doing so.]_

## E. Demonstration Credentials

Every account below was created by `npm run seed`. Password for all of them:
`Password123!` (or whatever `SEED_PASSWORD` was set to when you seeded the
target database — check `.env.local`/the deployment's environment).

### Northbridge University (NBU) — primary demo organization

| Email | Role | Designation |
|---|---|---|
| `admin@nbu.demo` | Organization Administrator | — |
| `ayesha@nbu.demo` | Member | Lecturer (memo author) |
| `karim@nbu.demo` | Member | Department Head, Computer Science |
| `nadia@nbu.demo` | Member | Finance Manager |
| `imran@nbu.demo` | Member | Director |
| `sabrina@nbu.demo` | Member | HR Officer |
| `rafi@nbu.demo` | Member | Procurement Officer |
| `tania@nbu.demo` | Member | Senior Lecturer (delegate) |

### Aurora Logistics (AUR) — second organization, for the isolation demo

| Email | Role | Designation |
|---|---|---|
| `admin@aurora.demo` | Organization Administrator | — |
| `meera@aurora.demo` | Member | Operations Lead |
| `devendra@aurora.demo` | Member | Warehouse Supervisor |
| `priya@aurora.demo` | Member | Finance Officer |

---

## Demonstration script (§28)

Every step below can be run against the deployed URL. Numbers in brackets
reference the exact seeded record so an evaluator can jump straight to it,
but the whole flow also works starting from nothing — steps 1–4 describe
exactly what to do to create an organization, users, and a memo from
scratch.

1. **Create an organization.** Go to `/register-organization` and fill in a
   new organization name, a short code, your name, an email, and a
   password of at least 10 characters. Submitting signs you in as that
   organization's administrator.
2. **Create multiple users.** As the admin, go to **Administration → Users**
   and add a few users, assigning a department and a role to each. Each
   creation shows a one-time temporary password — record it.
   *(Already done for you in Northbridge University — see the table above.)*
3. **Create a memo.** Sign in as a regular user (e.g. `ayesha@nbu.demo`), go
   to **New memo**, fill in a subject, department, category, priority, and
   body, and save it as a draft.
4. **Define a sequential workflow.** On the draft's edit page, under
   *Workflow participants*, either pick a template (Purchase Request,
   Leave Request, or Procurement Request) or build a custom ordered list —
   assign a real user and an action (approve/review) to each position.
5. **Submit the memo.** Open the memo (from *My Memos*) and click *Submit
   for approval*.
   *(Seeded example already at this stage: `NBU-2026-0002`,
   "Conference travel — ICSE 2027".)*
6. **Log in as the first workflow participant** (`karim@nbu.demo` for the
   seeded example). It appears in their **Inbox**.
7. **Comment, approve, reject, or request changes.** From the memo detail
   page, use the action panel — every workflow-changing action, plus a
   plain comment, is available there.
8. **Demonstrate the memo moving to the next participant.** After an
   approval, the workflow rail's current step advances and the next
   assignee is notified.
   *(Seeded example partway through this: `NBU-2026-0003`, "New GPU
   workstation for the research lab" — step 1 already approved by Karim,
   now awaiting Nadia.)*
9. **Demonstrate the complete workflow history.** The memo detail page's
   *Activity* timeline shows every event with actor, timestamp, and
   comment; *N versions* (top of the page, when N > 1) shows every prior
   draft.
   *(Seeded example with a full request-changes → resubmit cycle:
   `NBU-2026-0004`, "Adjunct instructor appointment — Spring term".)*
10. **Demonstrate final approval or rejection.**
    - Approved, full history, with an attachment: `NBU-2026-0006`,
      "Annual leave calendar — publication".
    - Rejected, with a reason: `NBU-2026-0005`, "Vendor contract —
      off-campus catering".
11. **Demonstrate notifications.** The bell icon (top bar / sidebar) shows
    an unread count; `/notifications` lists them, each linking to its
    memo, with a *mark read*/*mark all read* control.
12. **Demonstrate search and filtering.** `/search` — try a keyword (e.g.
    "oscilloscope" or any word from a memo body), or filter by author,
    department, category, status, priority, or date range. `/inbox`,
    `/memos`, and `/completed` each have their own status/priority filters.
13. **Demonstrate administrative functionality.** As `admin@nbu.demo`:
    **Administration → Overview** (org-wide stats), **Users**,
    **Departments**, **Categories**, **Workflow Templates**, **Reports**
    (filterable statistics, including average workflow completion time),
    and **Audit Log** (every significant event, filterable, read-only).
14. **Demonstrate that a user from another organization cannot access the
    memo.** Log in as any Aurora Logistics account (e.g.
    `meera@aurora.demo`) and try to open a Northbridge memo directly by URL
    — copy any `/memos/<id>` link from a Northbridge session and paste it
    while signed in as Aurora. It returns **not found**, not a permission
    error, and Aurora's search/inbox/dashboard never surface Northbridge
    data. `Aurora Logistics` also has its own seeded memo
    (`AUR-2026-0001`) to show a second organization's workflow in
    isolation.

## Deploying

Live at the URL above: Vercel (application) + Neon (Postgres), with
`DATABASE_URL` set to Neon's pooled connection string as the only environment
variable. `README.md` §10 documents the steps to reproduce it from scratch.

Migrations are not run by the build; `npm run db:migrate` is run against Neon
directly whenever the schema changes.
