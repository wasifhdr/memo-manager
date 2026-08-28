'use client'

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { setParticipantsAction } from '@/app/(app)/memos/actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Select, Input, FieldError } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import type { RequiredAction } from '@/db/schema'

export type Step = { assigneeUserId: string; positionTitle: string; requiredAction: RequiredAction }
export type ActiveUser = { id: string; name: string; designation: string | null }
export type Template = { id: string; name: string; steps: { positionTitle: string; requiredAction: RequiredAction }[] }

export function stepsAreComplete(steps: Step[]): boolean {
  return steps.length > 0 && steps.every((s) => s.assigneeUserId && s.positionTitle.trim())
}

/**
 * The ordered list of participants, as controlled state. Used both by the
 * New memo modal (where the steps are saved with the memo itself) and by
 * `ParticipantPicker` below (where they are saved on their own).
 */
export function ParticipantSteps({
  steps, onChange, activeUsers, templates, action,
}: {
  steps: Step[]
  onChange: (steps: Step[]) => void
  activeUsers: ActiveUser[]
  templates: Template[]
  /** Rendered opposite "Add participant" — e.g. a save button. */
  action?: ReactNode
}) {
  const [templateId, setTemplateId] = useState('')
  const fieldId = useId()

  const userOptions = activeUsers.map((u) => ({ value: u.id, label: u.designation ? `${u.name} — ${u.designation}` : u.name }))

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
            <Input
              value={step.positionTitle}
              onChange={(e) => update(i, { positionTitle: e.target.value })}
              placeholder="Position (e.g. Department Head)"
              className="h-9 w-44"
            />
            <Select
              value={step.assigneeUserId}
              onChange={(e) => update(i, { assigneeUserId: e.target.value })}
              placeholder="Assign to…"
              options={userOptions}
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

/** The standalone editor on the memo edit page: same list, saved on its own. */
export function ParticipantPicker({
  memoId, activeUsers, templates, initialSteps,
}: {
  memoId: string
  activeUsers: ActiveUser[]
  templates: Template[]
  initialSteps: Step[]
}) {
  const [steps, setSteps] = useState<Step[]>(initialSteps)
  const toast = useToast()

  const [state, formAction, pending] = useActionState<ActionState, FormData>(setParticipantsAction, undefined)
  const last = useRef<ActionState>(undefined)
  useEffect(() => {
    if (state && state !== last.current && state.ok) toast.success('Workflow participants saved.')
    last.current = state
  }, [state, toast])

  return (
    <div>
      <ParticipantSteps
        steps={steps}
        onChange={setSteps}
        activeUsers={activeUsers}
        templates={templates}
        action={
          <form action={formAction}>
            <input type="hidden" name="id" value={memoId} />
            <input type="hidden" name="steps" value={JSON.stringify(steps)} />
            <Button type="submit" size="sm" disabled={pending || !stepsAreComplete(steps)}>
              {pending ? 'Saving…' : 'Save workflow'}
            </Button>
          </form>
        }
      />
      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
    </div>
  )
}
