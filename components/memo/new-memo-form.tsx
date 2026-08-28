'use client'

import { useActionState, useRef, useState } from 'react'
import { createMemoAction } from '@/app/(app)/memos/actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, FieldError } from '@/components/ui/field'
import { MemoEditor } from '@/components/memo/editor'
import { ParticipantSteps, type ActiveUser, type Step, type Template } from '@/components/memo/participant-picker'
import { IconPaperclip, IconClose } from '@/components/ui/icons'
import {
  ATTACHMENT_MAX_BYTES, ATTACHMENT_MAX_PER_MEMO,
  ATTACHMENT_MAX_REQUEST_BYTES, overRequestBudget, formatBytes,
} from '@/lib/attachment-limits'

type Option = { value: string; label: string }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-(--color-sand) pt-4">
      <h3 className="mb-3 text-label uppercase text-(--color-ink)/70">{title}</h3>
      {children}
    </section>
  )
}

/**
 * The entire memo in one form: fields, workflow participants and attachments.
 * "Publish" submits it into the workflow, "Save draft" stops at draft; both
 * redirect to the memo, so there is no success state to handle here.
 */
export function NewMemoForm({
  departments, categories, activeUsers, templates, designations, onCancel,
}: {
  departments: Option[]
  categories: Option[]
  activeUsers: ActiveUser[]
  templates: Template[]
  designations: string[]
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createMemoAction, undefined)
  const [steps, setSteps] = useState<Step[]>([])
  const [files, setFiles] = useState<File[]>([])
  // Set by whichever submit button was pressed — a click always precedes the
  // form's own submit event, so this is settled by the time `submit` runs.
  const publish = useRef(false)

  const attachedBytes = files.reduce((n, f) => n + f.size, 0)
  const tooMuch = overRequestBudget(files.map((f) => f.size))

  function submit(formData: FormData) {
    formData.set('publish', publish.current ? 'true' : 'false')
    formData.set('steps', JSON.stringify(steps))
    for (const file of files) formData.append('files', file)
    formAction(formData)
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" required maxLength={200} placeholder="What is this memo about?" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="departmentId" hint="optional">Department</Label>
          <Select id="departmentId" name="departmentId" placeholder="None" options={departments} />
        </div>
        <div>
          <Label htmlFor="categoryId" hint="optional">Category</Label>
          <Select id="categoryId" name="categoryId" placeholder="None" options={categories} />
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select
            id="priority" name="priority" defaultValue="normal"
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="bodyHtml">Memo body</Label>
        <MemoEditor name="bodyHtml" />
      </div>

      <Section title="Workflow participants">
        <ParticipantSteps
          steps={steps} onChange={setSteps} activeUsers={activeUsers}
          templates={templates} designations={designations}
        />
        {steps.length === 0 ? (
          <p className="mt-1 text-[0.75rem] text-(--color-ink)/50">
            A draft can wait, but publishing needs at least one participant.
          </p>
        ) : null}
      </Section>

      <Section title="Attachments">
        {files.length > 0 ? (
          <ul className="mb-2.5 flex flex-col gap-1.5">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center gap-2 rounded-[var(--radius-control)] border border-(--color-sand) bg-(--color-paper) px-3 py-2 text-[0.8125rem]"
              >
                <IconPaperclip className="size-3.5 shrink-0 text-(--color-ink)/50" />
                <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
                <span className="shrink-0 font-mono-nums text-(--color-ink)/50">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles((f) => f.filter((_, idx) => idx !== i))}
                  aria-label={`Remove ${file.name}`}
                  className="flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-dot)] text-(--color-ink)/50 hover:bg-(--color-cream) hover:text-(--color-red-deep)"
                >
                  <IconClose className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {files.length < ATTACHMENT_MAX_PER_MEMO ? (
          <input
            type="file"
            multiple
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? [])
              setFiles((f) => [...f, ...picked].slice(0, ATTACHMENT_MAX_PER_MEMO))
              e.target.value = ''
            }}
            className="w-full text-[0.8125rem] text-(--color-ink)/70 file:mr-3 file:rounded-[var(--radius-dot)] file:border-0 file:bg-(--color-cream) file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-bold file:text-(--color-ink)"
          />
        ) : null}
        <p className="mt-1 text-[0.75rem] text-(--color-ink)/50">
          Up to {(ATTACHMENT_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB per file, {ATTACHMENT_MAX_PER_MEMO} files per memo,
          and {formatBytes(ATTACHMENT_MAX_REQUEST_BYTES)} in one go
          {files.length > 0 ? ` — ${formatBytes(attachedBytes)} attached` : ''}.
        </p>
        {tooMuch ? (
          <FieldError>
            {`Those files total ${formatBytes(attachedBytes)}. Attach up to `
              + `${formatBytes(ATTACHMENT_MAX_REQUEST_BYTES)} with the memo and add the rest from the memo page afterwards.`}
          </FieldError>
        ) : null}
      </Section>

      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>

      <div className="flex flex-wrap items-center gap-3 border-t border-(--color-sand) pt-4">
        <Button type="submit" variant="success" onClick={() => { publish.current = true }} disabled={pending || tooMuch}>
          {pending ? 'Working…' : 'Publish'}
        </Button>
        <Button type="submit" variant="gold" onClick={() => { publish.current = false }} disabled={pending || tooMuch}>
          Save draft
        </Button>
        <Button type="button" variant="danger" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
