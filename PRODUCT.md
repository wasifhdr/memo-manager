# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router, TypeScript), Tailwind CSS v4 (CSS-first, no `tailwind.config.js`), Drizzle ORM over Postgres. Decided with the user during the design phase preceding this file (see `docs/superpowers/specs/2026-08-27-memo-management-design.md`), not through this skill's stack question.

## Users

- **Regular users** (employees, department staff): create memos, save drafts, submit them into a workflow, and act on memos routed to them — approve, reject, comment, or request changes — only when it is their turn.
- **Department heads, finance managers, directors** and similar approval-chain participants: the same "regular user" role, distinguished only by where they sit in a given memo's workflow sequence.
- **Organization administrators**: manage their organization's departments, users, memo categories, and workflow templates; view organization-wide statistics and audit history. Every admin capability is scoped to their own organization.
- All users belong to exactly one **organization** (tenant). The system hosts multiple organizations at once; a user of one organization must never see another's data.

## Product Purpose

A multi-tenant inter-office memo management system: create a memo, route it through a defined sequence of people who must review, comment, approve, reject, or request changes, and preserve the complete history of that workflow. It exists to replace ad hoc paper/email memo routing with an auditable, sequential digital approval process. Success is a workflow that enforces its sequence server-side (a participant cannot act out of turn), keeps tenant data strictly isolated, and leaves a complete, tamper-evident record of every action.

## Positioning

Built to satisfy a university course specification (CSE226.1 Project 3, an Inter-Office Memo Management System) as a genuinely production-quality, deployed application — not a UI mockup. The differentiator the spec itself calls out: a system that "merely presents a convincing user interface but does not correctly implement the underlying functionality, data persistence, authorization, workflow, or tenant isolation will not satisfy the requirements." The mechanism that competitors-in-spirit (a form builder, a generic ticketing tool) could not truthfully claim: server-enforced sequential workflow state with row-level locking, and tenant isolation structural to every query rather than a UI filter.

## Operating Context

- A memo's lifecycle: drafted by its author → submitted with an ordered list of participants → moves through each participant's step in strict order → ends approved, rejected, or cancelled.
- Each organization defines its own departments, memo categories (Administrative, Financial, Procurement, HR, Academic, Technical, General), and reusable workflow templates (e.g. Purchase Request: Employee → Department Head → Finance → Director).
- Users work from an **inbox** (memos awaiting their action), **My Memos** (what they authored), and a **dashboard** summarizing counts and recent activity.
- A memo can be returned for changes and resubmitted, which opens a new "cycle" while preserving every prior version and cycle's history — nothing is overwritten.
- Delegation lets one user act on another's behalf for a bounded period; every such action records both identities.
- The deployed system must demonstrate, end to end: creating an organization, creating users, creating and routing a memo through multiple participants, notifications, search, admin functions, and that a user from a different organization cannot reach another organization's memo.

## Capabilities and Constraints

- Rich text in memo bodies is basic formatting only (bold, italic, lists, headings, links) — sanitized server-side on save.
- Attachments are stored as bytes in Postgres (no persistent disk on the hosting platform), capped at 4 MB per file and 10 files per memo, served only through an authorized download route — never a directly guessable URL.
- No outbound email in this version. Password reset is a token surfaced via server log and an admin-generated link, not a sent email. Explicitly allowed by the governing spec, which lists email as optional.
- PDF export renders memo content, workflow history, and a final-status stamp using a pure-JS PDF library (no headless browser), because the hosting platform's free tier cannot run one.
- Every workflow action re-validates the actor's authorization server-side inside a row-locked transaction; a hidden or disabled UI control is never the actual gate.
- Two roles only: `org_admin` and `user`. No custom per-permission roles in this version.

## Brand Commitments

No existing brand, name, or visual identity to preserve — this is a new build with no incumbent design system beyond the framework scaffold's defaults. "Memo Manager" is the working project name; no logo or wordmark exists yet.

## Evidence on Hand

No real customer content, screenshots, or prior deployments. The specification document (`Project_3_PRD.md` / `CSE226_Summer_26_Project-3.md`) is the authoritative source for every functional requirement referenced above. Demo data is Claude-authored synthetic content (two fictional organizations, fictional staff) seeded for the graded demonstration — never presented as real.

## Product Principles

1. **Server is the only authority.** Every permission, every workflow-sequence rule, and every tenant boundary is enforced in server code against the database, never inferred from what the client renders.
2. **Nothing is silently lost.** Departments are deactivated, not deleted; memo versions and workflow cycles accumulate rather than overwrite; comments and history are append-only.
3. **The current step must be obvious at a glance.** Whoever looks at a memo — its author, a participant, an admin — should immediately see what has happened, what is happening, and who is responsible next, on a phone as readily as a desktop.
4. **Status and priority are different questions and must look like different questions.** A memo's lifecycle state and its urgency are shown through visually distinct channels so they never blur into one reading.
5. **Quiet, document-grade seriousness over dashboard flash.** The audience is office staff doing accountable paperwork, not consumers being delighted — the interface should read like a well-set official document, not a marketing product.

## Accessibility & Inclusion

No user-specific accessibility requirement was raised. Build to ordinary web standards (keyboard operability, sufficient contrast, visible focus states) as general good practice, not a stated product requirement.
