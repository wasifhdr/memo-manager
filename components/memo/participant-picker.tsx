'use client'

import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Select, Input } from '@/components/ui/field'
import type { RequiredAction } from '@/db/schema'

export type Step = { assigneeUserId: string; positionTitle: string; requiredAction: RequiredAction }
export type ActiveUser = { id: string; name: string; designation: string | null }
export type Template = { id: string; name: string; steps: { positionTitle: string; requiredAction: RequiredAction }[] }

export function stepsAreComplete(steps: Step[]): boolean {
  return steps.length > 0 && steps.every((s) => s.assigneeUserId && s.positionTitle.trim())
}

/**
 * Who can fill a step carrying this position: the people whose designation
 * matches it, compared case-insensitively. A blank position means the position
 * has not been decided yet, so anyone in the organization is available.
 *
 * `keepId` keeps an already-chosen person in the list even when they no longer
 * match, so an existing assignment never vanishes from the field.
 */
export function peopleForPosition(
  users: ActiveUser[], position: string, keepId?: string,
): ActiveUser[] {
  const wanted = position.trim().toLowerCase()
  if (!wanted) return users
  const matches = users.filter((u) => (u.designation ?? '').trim().toLowerCase() === wanted)
  if (keepId && !matches.some((u) => u.id === keepId)) {
    const kept = users.find((u) => u.id === keepId)
    if (kept) return [...matches, kept]
  }
  return matches
}

function userOptionsOf(users: ActiveUser[]) {
  return users.map((u) => ({ value: u.id, label: u.designation ? `${u.name} — ${u.designation}` : u.name }))
}

/**
 * The ordered list of participants, as controlled state. Used by the New memo
 * and Edit memo modals, which save the steps together with the memo itself.
 */
export function ParticipantSteps({
  steps, onChange, activeUsers, templates, designations, action,
}: {
  steps: Step[]
  onChange: (steps: Step[]) => void
  activeUsers: ActiveUser[]
  templates: Template[]
  /** The organization's designations, offered as position titles. */
  designations: string[]
  /** Rendered opposite "Add participant" — e.g. a save button. */
  action?: ReactNode
}) {
  const [templateId, setTemplateId] = useState('')
  const fieldId = useId()

  function applyTemplate(id: string) {
    setTemplateId(id)
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) return
    onChange(tpl.steps.map((s) => ({ assigneeUserId: '', positionTitle: s.positionTitle, requiredAction: s.requiredAction })))
  }

  function move(i: number, dir: -1 | 1) {
    const next = [...steps]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  function update(i: number, patch: Partial<Step>) {
    onChange(steps.map((step, idx) => (idx === i ? { ...step, ...patch } : step)))
  }

  /** Changing the position narrows the people; anyone who no longer fits is dropped. */
  function setPosition(i: number, positionTitle: string) {
    const step = steps[i]
    const stillFits = peopleForPosition(activeUsers, positionTitle)
      .some((u) => u.id === step.assigneeUserId)
    update(i, { positionTitle, assigneeUserId: stillFits ? step.assigneeUserId : '' })
  }

  return (
    <div>
      {templates.length > 0 ? (
        <div className="mb-4">
          <label htmlFor={`${fieldId}-template`} className="mb-1.5 block text-label uppercase text-(--color-ink)/70">
            Start from a template
          </label>
          <Select
            id={`${fieldId}-template`}
            value={templateId}
            onChange={(e) => applyTemplate(e.target.value)}
            placeholder="Custom workflow"
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
            className="max-w-xs"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-(--color-sand) bg-(--color-paper) p-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-(--color-cream) font-mono-nums text-[0.75rem] font-bold text-(--color-ink)/70">
              {i + 1}
            </span>
            <PositionField
              value={step.positionTitle}
              onChange={(positionTitle) => setPosition(i, positionTitle)}
              designations={designations}
              className="h-9 w-52"
            />
            <Select
              value={step.assigneeUserId}
              onChange={(e) => update(i, { assigneeUserId: e.target.value })}
              placeholder={
                step.positionTitle.trim() && peopleForPosition(activeUsers, step.positionTitle).length === 0
                  ? 'Nobody holds this position'
                  : 'Assign to…'
              }
              options={userOptionsOf(peopleForPosition(activeUsers, step.positionTitle, step.assigneeUserId))}
              className="h-9 max-w-[20rem] flex-1"
            />
            <div className="ml-auto flex shrink-0 gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="flex size-7 items-center justify-center rounded-[var(--radius-dot)] text-(--color-ink)/50 hover:bg-(--color-cream) disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="flex size-7 items-center justify-center rounded-[var(--radius-dot)] text-(--color-ink)/50 hover:bg-(--color-cream) disabled:opacity-30">↓</button>
              <button type="button" onClick={() => onChange(steps.filter((_, idx) => idx !== i))} className="flex size-7 items-center justify-center rounded-[var(--radius-dot)] text-(--color-red-deep) hover:bg-(--color-cream)">✕</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => onChange([...steps, { assigneeUserId: '', positionTitle: '', requiredAction: 'approve' }])}
        >
          + Add participant
        </Button>
        {action}
      </div>
      {steps.length > 0 && !stepsAreComplete(steps) ? (
        <p className="mt-1 text-[0.75rem] text-(--color-ink)/50">Give every step a position and an assignee.</p>
      ) : null}
    </div>
  )
}

/**
 * Position titles come from the designations the organization's own users
 * carry. An organization that has not filled any in falls back to free text,
 * so a workflow can still be built on day one.
 */
export function PositionField({
  value, onChange, designations, className = '', placeholder = 'Position…', ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  designations: string[]
  className?: string
  placeholder?: string
  ariaLabel?: string
}) {
  if (designations.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={className}
      />
    )
  }
  // Designations match case-insensitively, so a step saved as "team lead"
  // selects the organization's "Team Lead" entry. A title that matches nothing
  // — an older custom one — is kept as its own option rather than silently
  // disappearing from the field.
  const trimmed = value.trim()
  const canonical = designations.find((d) => d.toLowerCase() === trimmed.toLowerCase())
  const options = [...designations, ...(trimmed && !canonical ? [trimmed] : [])]

  return (
    <Select
      value={canonical ?? trimmed}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      options={options.map((d) => ({ value: d, label: d }))}
      aria-label={ariaLabel}
      className={className}
    />
  )
}
