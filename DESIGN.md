---
name: Memo Manager
description: A document-grade administrative interface for routing and approving inter-office memos.
colors:
  bg: "#f4f5f7"
  surface: "#ffffff"
  surface-sunken: "#eceef1"
  border: "#d8dbe1"
  border-strong: "#b6bac3"
  ink: "#171a20"
  ink-muted: "#565d6b"
  ink-faint: "#868d99"
  stamp-ink-blue: "#2454d6"
  stamp-ink-blue-hover: "#1c40ac"
  status-draft: "#4a5160"
  status-pending: "#38597a"
  status-changes: "#8a5b09"
  status-rejected: "#a3271e"
  status-approved: "#1e7a4d"
  status-cancelled: "#75798a"
  priority-high: "#6a3aa0"
  priority-urgent: "#8f2465"
typography:
  document:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontWeight: 600
    letterSpacing: "-0.01em"
  chrome:
    fontFamily: "IBM Plex Sans, ui-sans-serif, -apple-system, sans-serif"
    fontWeight: 400
  reference:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontFeature: "tabular-nums"
rounded:
  sm: "0.3125rem"
  md: "0.5rem"
  lg: "0.875rem"
  pill: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.stamp-ink-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "0 1rem"
    height: "2.5rem"
  button-primary-hover:
    backgroundColor: "{colors.stamp-ink-blue-hover}"
  status-badge:
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.625rem"
  priority-tag:
    rounded: "0.25rem"
    padding: "0.125rem 0.5rem"
---

# Design System: Memo Manager

## Overview

**Creative North Star: "The Routing Slip"**

The product manages a real bureaucratic artifact — the memo that travels desk to desk, gathering initials, stamps, and margin notes until someone signs it off or sends it back. The interface takes that object as its model rather than a generic SaaS dashboard: quiet chrome, a strong typographic hierarchy, hairline dividers evoking ruled ledger paper, and a single decisive interactive color standing in for the stamp-pad ink that used to mark a memo "approved" or "returned."

This is an Operate-mode tool — office staff, department heads, and directors completing accountable paperwork, not consumers being delighted. Expression never gets ahead of the task: the current workflow step, the responsible person, and the required action must be legible in seconds, on a phone as readily as a desk monitor. Explicitly rejected: cream/parchment "warm document" clichés (the subject is institutional, not literary), gradient accents, card-of-icon-plus-heading page scaffolds, and any dashboard-flash affordance (progress rings, sparklines, glowing edges) that implies excitement rather than accountability.

**Key characteristics:**
- Cool, near-white paper ground — never warm cream.
- One serif (the document itself), one sans (the surrounding chrome), one mono (every reference number, date, and timestamp) — three voices, each doing one job.
- Status and priority are structurally and chromatically disjoint: status is a rounded pill in a green/blue-gray/amber/crimson/gray family; priority is a square-cornered tag in a violet/magenta family found nowhere else in the palette.
- Light is the working default (a desk, business hours); dark exists fully for off-hours approvals from a phone, not as an afterthought.

## Colors

Restrained strategy: neutrals carry every surface, one accent (`stamp-ink-blue`) marks every interactive element, and two independent small palettes — status and priority — never borrow each other's hues.

- **Ground** — `bg` #f4f5f7, `surface` #ffffff, `surface-sunken` #eceef1. A cool, slightly blue-gray neutral, deliberately not cream.
- **Ink** — `ink` #171a20 (body text), `ink-muted` #565d6b (secondary text, ≥4.5:1 on `surface`), `ink-faint` #868d99 (labels, timestamps, placeholders).
- **Accent** — `stamp-ink-blue` #2454d6 for buttons, links, focus rings, the selected nav item. Nothing else in the interface uses this hue.
- **Status** (memo lifecycle, rounded pill + icon): draft = slate #4a5160, submitted/pending = blue-gray #38597a, changes requested = amber #8a5b09, rejected = crimson #a3271e, approved = forest green #1e7a4d, cancelled = muted gray #75798a (struck icon).
- **Priority** (urgency, square tag + icon, violet/magenta family only): normal carries no badge at all — its absence is the signal; high = violet #6a3aa0; urgent = magenta #8f2465 with a flame glyph.

Every color redefines fully under `prefers-color-scheme: dark` and under a `data-theme="dark"` override for the manual toggle, keeping the same role structure with inverted luminance.

## Typography

Three families, three jobs, never interchanged:

- **Source Serif 4** — the memo's own subject/title and page `<h1>`/`<h2>` headings. This is the only place the interface speaks in the register of an actual printed document.
- **IBM Plex Sans** — everything else: navigation, buttons, labels, body UI copy, form fields. An engineered, quiet workhorse face — it should never be the thing a user notices.
- **IBM Plex Mono**, tabular figures — memo numbers, dates, timestamps, and any other reference code. Applied via the `.font-mono-nums` utility class.

Scale is conservative: page titles at `text-2xl`/`font-semibold`, section headings `text-sm`/`font-semibold`, body and controls at `text-sm` (0.875rem), labels and metadata at `0.75–0.8125rem`. No display type beyond page titles — this is a working tool, not a marketing surface.

## Layout

Two-column app shell: a fixed 15rem sidebar (organization identity, primary nav, an "Administration" section gated to `org_admin`, user menu) on `md` and above; below `md` the sidebar collapses to a slide-in drawer behind a hamburger button, with the notification bell staying visible in a persistent mobile top bar. Page content sits in a single scrolling `<main>` with responsive horizontal padding (`px-4` mobile → `px-8` desktop). Wide tabular content (the memo list, reports) scrolls horizontally inside its own container rather than the page.

## Elevation & Depth

Flat by default — most surfaces are a `border` hairline, not a shadow. Shadows are reserved for genuinely elevated layers: `shadow-sm` on cards and buttons (a soft, low-offset ambient shadow, never a hard block shadow), `shadow-md` on the sidebar drawer and dropdown menus, `shadow-lg` on the modal dialog and its `::backdrop`. Depth signals "this floats above the page," never decoration.

## Shapes

Small, consistent radii — `sm` 0.3125rem (buttons, inputs, small tags), `md` 0.5rem (dropdowns, toasts), `lg` 0.875rem (cards, the modal), `pill` (status badges only). Priority tags stay square-cornered (`0.25rem`) specifically to read as a different object class from status pills. Borders are hairline (1px) throughout; no colored `border-left` accents on cards or list rows.

## Components

- **Button** — four variants (`primary`, `secondary`, `ghost`, `danger`), three sizes. Primary is solid `stamp-ink-blue`; danger is the same crimson as the rejected-status color, reserved for destructive actions (reject, delete draft, cancel memo).
- **StatusBadge / PriorityBadge** — the load-bearing distinction in the whole system. Status: rounded pill, icon (hand-drawn, 1.75px stroke, one family — clock, edit, x-circle, check-circle, dashed/slashed circle) + word, colored per the Status palette. Priority: square tag, a different icon pair (chevrons-up / flame), colored per the Priority palette, rendered only for `high`/`urgent` — `normal` renders nothing.
- **DataTable** — hairline row dividers, sunken header row, whole-row click target via a stretched first-cell link, horizontal scroll container, a shared `EmptyState` when there are no rows.
- **Modal** — native `<dialog>` for built-in focus trapping and Escape-to-close; themed backdrop blur.
- **Toast** — bottom-right stack (bottom-center on mobile), auto-dismiss, success/error/info variants keyed to the same icon set as status badges.
- **AppShell** — see Layout. Owns the responsive collapse and the user menu (profile, delegations, notifications, log out).

## Do's and Don'ts

- **Do** keep status and priority visually disjoint — different shape, different hue family — everywhere both appear on the same row.
- **Do** reserve `stamp-ink-blue` for things a user can act on. A status or priority indicator never uses it.
- **Do** use `IBM Plex Mono` with tabular figures for every memo number, timestamp, and reference ID so columns of them align.
- **Don't** introduce a card-of-icon-plus-heading grid as page structure — this system uses `PageHeader` + `DataTable`/`Card` sections instead.
- **Don't** add a kicker/eyebrow label above a heading; let the heading and its `eyebrow` slot (used only for a real reference like a memo number) carry the weight.
- **Don't** reach for a hard offset shadow, gradient text, or a glass/blur decoration — this world is flat and hairline-bordered by commitment, not by omission.
