---
name: Memo Manager
description: A warm-editorial administrative interface for routing and approving inter-office memos.
colors:
  paper: "#fffdf8"
  cream: "#faf3e7"
  ink: "#3d3229"
  sand: "#cfcabe"
  orange: "#c2703d"
  orange-deep: "#8a4a22"
  gold: "#e9b44c"
  gold-deep: "#8a6420"
  green: "#6b8f71"
  green-deep: "#43614a"
  blue: "#5b7b9a"
  blue-deep: "#3d5a75"
  purple: "#8a7ba8"
  purple-deep: "#5f527e"
  red: "#a8443a"
  red-deep: "#7c2f27"
typography:
  display:
    fontFamily: "Source Serif 4, Georgia, serif"
    weights: [600, 700, 800, 900]
    use: "Brand wordmark, auth headlines, the memo body itself — never chrome or headings"
  sans:
    fontFamily: "Fira Sans, Arial, sans-serif"
    weights: [400, 500, 700, 800]
    use: "Everything else — nav, buttons, page headings, labels, body UI copy"
  mono:
    fontFamily: "Fira Mono, Consolas, monospace"
    weights: [400, 700]
    use: "Memo numbers, dates, timestamps — always tabular via .font-mono-nums"
rounded:
  dot: "6px"
  control: "12px"
  card: "16px"
  card-lg: "20px"
  pill: "999px"
shadow:
  offset-sm: "2px 2px 0 0 #3d3229"
  offset: "3px 3px 0 0 #3d3229"
  offset-lg: "6px 6px 0 0 #3d3229"
components:
  button-primary:
    backgroundColor: "{colors.orange}"
    textColor: "#ffffff"
    border: "2px solid {colors.ink}"
    rounded: "{rounded.control}"
    shadow: "{shadow.offset}"
    pressPhysics: "translate 3px + drop shadow on :active"
  status-badge:
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.625rem"
    border: "1px, tinted to tone"
  stat-chip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.card}"
---

# Design System: Memo Manager

## Provenance

This system is not bespoke to Memo Manager. It is the **Warm Editorial** visual
system — a frozen, reusable contract the project owner brought in from a prior
project ("API Builder") and applied here verbatim, per the governing source
file `D:/DESIGN.md`. Palette, type scale, radii, shadow system, and
interaction physics are frozen by that contract; nothing in this document
invents a new hex value, font size, or shadow — it records how the frozen
system was mapped onto this product's screens and one disclosed deviation
(mobile navigation, see Layout below).

## Overview

**Creative North Star: "The Approval Desk"**

Warm Editorial reads as a well-set printed document, not a SaaS dashboard:
warm parchment paper, a single serif voice reserved for the document itself,
and hard-edged, never-blurred "stamped" shadows standing in for the physical
weight of an ink stamp hitting paper. Chrome is a dark ink-colored bar, not a
sidebar — closer to a letterhead than an app frame.

This is an Operate-mode tool — office staff, department heads, and directors
completing accountable paperwork. The current workflow step, the responsible
person, and the required action must be legible in seconds, on a phone as
readily as a desk monitor. Status and priority are deliberately built from
different visual *devices*, not just different hues, so the two questions
never blur into one reading (see Components below).

**Key characteristics:**
- Warm parchment ground (`cream`/`paper`), ink-dark chrome — never cool gray.
- One serif (the memo's own subject/body), one sans (everything else), one
  mono (every reference number, date, and timestamp).
- Shadows are always hard 1:1 offsets in ink, never blurred — the signature
  "stamped paper" texture.
- Single theme, light only, by the frozen contract's own design — no dark
  mode exists in this system.

## Colors

- **Ground** — `paper` #fffdf8 (cards, inputs), `cream` #faf3e7 (page
  background, sunken surfaces).
- **Ink** — `ink` #3d3229, used at full opacity for primary text/borders and
  at `/70`, `/50` for secondary and tertiary text respectively (no separate
  muted/faint color tokens — opacity does that work).
- **Accent** — `orange` / `orange-deep` for every interactive/brand moment:
  primary buttons, links, the active nav pill, the eyebrow reference line.
- **Status** (memo lifecycle, filled pill + icon, `Badge`/`StatusBadge`):
  draft = neutral (sand/ink), submitted/pending review/pending approval =
  `blue`, changes requested = `gold`, rejected = `red`, approved = `green`,
  cancelled = neutral.
- **Priority** (urgency, `PriorityBadge`): deliberately **not** a filled pill
  — every pill hue is already claimed by status, and priority sharing that
  device would let the two compete. `normal` renders nothing; `high` is a
  plain chevrons-up glyph in `ink/70`; `urgent` is a flame glyph in
  `red-deep` with a small pulsing dot. Status and priority are now
  structurally different objects, not just different colors, so a status of
  "rejected" and a priority of "urgent" — both red — never collide.

## Typography

Three families, three jobs, per the frozen contract:

- **Source Serif 4** (`font-display`) — the brand wordmark, auth-screen
  headlines, and — the one place body copy speaks in the document's own
  voice — the memo text itself (`.prose-memo`). It is never used for page
  `<h1>`/`<h2>` chrome headings; those are sans, per the contract's own
  "Headings (font-sans)" rule.
- **Fira Sans** (`font-sans`) — everything else: nav, buttons, `PageHeader`
  titles, labels, form fields, table content.
- **Fira Mono** (`font-mono`), tabular figures — memo numbers, dates,
  timestamps, byte sizes. Applied via `.font-mono-nums`.

Scale: `text-display` 3.5rem/800 and `text-display-sm` 2.25rem/800 (marketing
bands only, unused on data screens), `text-h1` 1.75rem/700 (page titles),
`text-h2` 1.3125rem/700, `text-h3` 1.0625rem/700 (card/modal headings),
`text-label` 0.72rem/800/uppercase/wide-tracking (CapsLabel — field labels,
eyebrows, badge/rail metadata). Body and controls sit at 15px.

## Layout

A single horizontal `bg-ink` top bar (`AppShell`), not a sidebar: brand mark
+ wordmark on the left, primary nav as pill links in the center, notification
bell + user chip + logout on the right. Pages sit in a centered `max-w-6xl`
column below it. An admin section gets its own secondary pill-tab row nested
under the header (`AdminSubNav`), not a second sidebar.

**One disclosed deviation from the frozen contract:** the source system
specifies that below ~900px the header "collapses to brand + logout." This
build instead opens a full ink-themed drawer with the complete nav, admin
link, and account actions. §22 of the governing product spec requires the
app to stay genuinely usable on a phone, not merely present — an approver
who only has their phone must still be able to reach every section, not just
sign out.

## Elevation & Shapes

Hard-offset, never-blurred shadows are the system's signature: `shadow-offset-sm`
(2px), `shadow-offset` (3px), `shadow-offset-lg` (6px), all a flat ink-colored
offset with no blur. Interactive elements press flat on `:active`
(`translate` by the shadow's own offset + `shadow-none`) — the shadow
*is* the affordance that something is pressable.

Radii scale by role, not by component: `radius-dot` 6px (icon-only buttons,
small chips), `radius-control` 12px (buttons, inputs, rows, the editor
frame), `radius-card` 16px (cards, panels, `EmptyState`), `radius-card-lg`
20px (the modal), `radius-pill` 999px (badges, nav pills, avatar chips).

## Components

- **Button** — `primary` (solid orange), `secondary`/`default` (paper with
  ink border), `ink` (solid ink, for the highest-emphasis action on a page),
  `danger` (solid red), `ghost`/`danger-ghost` (borderless). All carry the
  2px ink border + hard-offset shadow + press-collapse physics except ghost
  variants.
- **StatusBadge / PriorityBadge** — see Colors above; the load-bearing
  distinction in the system. They are never allowed to share a visual device.
- **StatChip** (`components/dashboard/stat-tile.tsx`) — the system's
  signature inverse treatment: `bg-ink` chip with paper mono numerals: used
  for the dashboard's summary counts. An "urgent" tone highlights the
  numeral in gold with a pulsing dot rather than reaching for red, since red
  is reserved for the rejected/urgent-priority semantic elsewhere.
- **WorkflowRail** (`components/memo/workflow-rail.tsx`) — the product's
  signature component: each cycle's steps render as a row of cards (stacking
  on mobile), the current step picked out with a 2px orange border, orange
  tint, and `shadow-offset-sm`; future steps dashed and dimmed; resolved
  steps colored by outcome (approved/reviewed green, rejected red, changes
  requested gold, skipped dimmed). Previous cycles collapse behind a
  `<details>` disclosure.
- **DataTable** — hairline `sand` row dividers, an uppercase `text-label`
  header row with a 2px ink bottom rule (no filled sunken header), cream
  hover state, horizontal scroll container.
- **Modal** — native `<dialog>`, 2px ink border, `shadow-offset-lg`,
  `radius-card-lg`, blurred ink-tinted `::backdrop`.
- **Toast** — bottom stack, 2px ink border + `shadow-offset-lg`, a left
  severity stripe (green/red/gold) instead of a tinted fill.
- **AppShell** — see Layout.

## Do's and Don'ts

- **Do** keep status and priority on different visual *devices* (filled pill
  vs. plain icon+text), not just different hues — this is what lets the
  palette's every hue be reused between the two without collision.
- **Do** reserve the serif (`font-display`) for the memo's own voice — the
  wordmark, auth headlines, and memo body — never page chrome.
- **Do** use hard-offset shadows and press-collapse physics on every clickable
  surface; a blurred/soft shadow anywhere is a system violation.
- **Don't** add a second sidebar for admin — nest its nav as a secondary
  pill-tab row under the same `AppShell` header.
- **Don't** introduce a dark theme — this system is committed single-theme,
  light only, by the frozen contract.
