'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { setParticipantsAction } from '@/app/(app)/memos/actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Select, Input, FieldError } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import type { RequiredAction } from '@/db/schema'

type Step = { assigneeUserId: string; positionTitle: string; requiredAction: RequiredAction }
type ActiveUser = { id: string; name: string; designation: string | null }
type Template = { id: string; name: string; steps: { positionTitle: string; requiredAction: RequiredAction }[] }

export function ParticipantPicker({
  memoId, activeUsers, templates, initialSteps,
}: {
  memoId: string
  activeUsers: ActiveUser[]
  templates: Template[]
  initialSteps: Step[]
}) {
  const [steps, setSteps] = useState<Step[]>(initialSteps)
  const [templateId, setTemplateId] = useState('')
  const formId = useId()
  const toast = useToast()

  const [state, formAction, pending] = useActionState<ActionState, FormData>(setParticipantsAction, undefined)
  const last = useRef<ActionState>(undefined)
  useEffect(() => {
    if (state && state !== last.current && state.ok) toast.success('Workflow participants saved.')
    last.current = state
  }, [state, toast])

  const userOptions = activeUsers.map((u) => ({ value: u.id, label: u.designation ? `${u.name} — ${u.designation}` : u.name }))

  function applyTemplate(id: string) {
    setTemplateId(id)
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) return
    setSteps(tpl.steps.map((s) => ({ assigneeUserId: '', positionTitle: s.positionTitle, requiredAction: s.requiredAction })))
  }

  function addStep() {
    setSteps((s) => [...s, { assigneeUserId: '', positionTitle: '', requiredAction: 'approve' }])
  }
  function removeStep(i: number) {
    setSteps((s) => s.filter((_, idx) => idx !== i))
  }
  function move(i: number, dir: -1 | 1) {
    setSteps((s) => {
      const next = [...s]
      const j = i + dir
      if (j < 0 || j >= next.length) return s
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  function update(i: number, patch: Partial<Step>) {
    setSteps((s) => s.map((step, idx) => (idx === i ? { ...step, ...patch } : step)))
  }

  const canSubmit = steps.length > 0 && steps.every((s) => s.assigneeUserId && s.positionTitle.trim())

  return (
    <div>
      {templates.length > 0 ? (
        <div className="mb-4">
          <label htmlFor={`${formId}-template`} className="mb-1.5 block text-[0.8125rem] font-medium text-(--text)">
            Start from a template
          </label>
          <Select
            id={`${formId}-template`}
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
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-(--border) bg-(--surface) p-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-(--surface-sunken) font-mono-nums text-[0.75rem] font-semibold text-(--text-muted)">
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
              className="h-9 max-w-[16rem] flex-1"
            />
            <Select
              value={step.requiredAction}
              onChange={(e) => update(i, { requiredAction: e.target.value as RequiredAction })}
              options={[{ value: 'approve', label: 'Approve' }, { value: 'review', label: 'Review' }]}
              className="h-9 w-32"
            />
            <div className="ml-auto flex shrink-0 gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-(--text-faint) hover:bg-(--surface-sunken) disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-(--text-faint) hover:bg-(--surface-sunken) disabled:opacity-30">↓</button>
              <button type="button" onClick={() => removeStep(i)} className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-(--st-rejected-fg) hover:bg-(--surface-sunken)">✕</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={addStep}>+ Add participant</Button>
        <form action={formAction}>
          <input type="hidden" name="id" value={memoId} />
          <input type="hidden" name="steps" value={JSON.stringify(steps)} />
          <Button type="submit" size="sm" disabled={pending || !canSubmit}>
            {pending ? 'Saving…' : 'Save workflow'}
          </Button>
        </form>
      </div>
      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
      {!canSubmit && steps.length > 0 ? (
        <p className="mt-1 text-[0.75rem] text-(--text-faint)">Give every step a position and an assignee before saving.</p>
      ) : null}
    </div>
  )
}
