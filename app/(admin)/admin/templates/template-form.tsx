'use client'

import { useActionState, useState } from 'react'
import { createTemplate, updateTemplate } from './actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input, Select, FieldError } from '@/components/ui/field'
import type { RequiredAction } from '@/db/schema'

type Step = { positionTitle: string; requiredAction: RequiredAction }

export function TemplateForm({
  mode, template, onDone,
}: {
  mode: 'create' | 'edit'
  template?: { id: string; name: string; description: string | null; steps: Step[] }
  onDone?: () => void
}) {
  const [name, setName] = useState(template?.name ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [steps, setSteps] = useState<Step[]>(template?.steps ?? [{ positionTitle: '', requiredAction: 'approve' }])

  const action = mode === 'create' ? createTemplate : updateTemplate
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    (prev, fd) => action(prev, fd).then((r) => { if (r?.ok) onDone?.(); return r }),
    undefined,
  )

  function addStep() { setSteps((s) => [...s, { positionTitle: '', requiredAction: 'approve' }]) }
  function removeStep(i: number) { setSteps((s) => s.filter((_, idx) => idx !== i)) }
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

  const canSubmit = name.trim().length >= 2 && steps.length > 0 && steps.every((s) => s.positionTitle.trim())

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode === 'edit' && template ? <input type="hidden" name="id" value={template.id} /> : null}
      <input type="hidden" name="steps" value={JSON.stringify(steps)} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[0.8125rem] font-medium text-(--color-ink)" htmlFor="tpl-name">Template name</label>
          <Input id="tpl-name" name="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Purchase Request" />
        </div>
        <div>
          <label className="mb-1.5 block text-[0.8125rem] font-medium text-(--color-ink)" htmlFor="tpl-desc">Description (optional)</label>
          <Input id="tpl-desc" name="description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 rounded-[var(--radius-control)] border border-(--color-sand) bg-(--color-paper) p-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-(--color-cream) font-mono-nums text-[0.75rem] font-semibold text-(--color-ink)/70">
              {i + 1}
            </span>
            <Input
              value={step.positionTitle}
              onChange={(e) => update(i, { positionTitle: e.target.value })}
              placeholder="Position title (e.g. Department Head)"
              className="h-9 flex-1"
            />
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="flex size-7 items-center justify-center rounded-[var(--radius-control)] text-(--color-ink)/50 hover:bg-(--color-cream) disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="flex size-7 items-center justify-center rounded-[var(--radius-control)] text-(--color-ink)/50 hover:bg-(--color-cream) disabled:opacity-30">↓</button>
              <button type="button" onClick={() => removeStep(i)} className="flex size-7 items-center justify-center rounded-[var(--radius-control)] text-(--color-red-deep) hover:bg-(--color-cream)">✕</button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={addStep}>+ Add step</Button>
        <Button type="submit" size="sm" disabled={pending || !canSubmit}>
          {pending ? 'Saving…' : mode === 'create' ? 'Create template' : 'Save changes'}
        </Button>
        {mode === 'edit' && onDone ? <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button> : null}
      </div>
      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
    </form>
  )
}
