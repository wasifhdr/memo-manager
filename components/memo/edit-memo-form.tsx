'use client'

import { useActionState, useRef, useState } from 'react'
import { updateMemoAction, deleteDraftAction } from '@/app/(app)/memos/actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, FieldError } from '@/components/ui/field'
import { MemoEditor } from '@/components/memo/editor'
import { AttachmentList, type AttachmentItem } from '@/components/memo/attachment-list'
import { ParticipantSteps, type ActiveUser, type Step, type Template } from '@/components/memo/participant-picker'
import type { Priority } from '@/db/schema'

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
 * Editing a memo in place: the same shape as the New memo modal, ending in
 * publish / save / cancel.
 *
 * The workflow is only editable while the memo is a draft. Once it has been
 * through a cycle, its steps carry recorded decisions — including the one that
 * asked for these changes, which is where the resubmission resumes — so the
 * queue is shown read-only here and re-routed from the memo page instead.
 */
export function EditMemoForm({
  memo, departments, categories, attachments, participants, activeUsers, templates, designations, onCancel,
}: {
  memo: {
    id: string; subject: string; bodyHtml: string
    departmentId: string | null; categoryId: string | null; priority: Priority
    status: 'draft' | 'changes_requested'
  }
  departments: Option[]
  categories: Option[]
  attachments: AttachmentItem[]
  participants: { assigneeUserId: string; positionTitle: string; requiredAction: Step['requiredAction']; assigneeName: string }[]
  activeUsers: ActiveUser[]
  templates: Template[]
  designations: string[]
  onCancel: () => void
}) {
  const isDraft = memo.status === 'draft'
  const [steps, setSteps] = useState<Step[]>(
    participants.map((p) => ({
      assigneeUserId: p.assigneeUserId, positionTitle: p.positionTitle, requiredAction: p.requiredAction,
    })),
  )
  // Set by whichever button submitted; a click always precedes the submit event.
  const publish = useRef(false)

  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateMemoAction, undefined)
  const [, deleteAction, deleting] = useActionState<ActionState, FormData>(deleteDraftAction, undefined)

  function submit(formData: FormData) {
    formData.set('publish', publish.current ? 'true' : 'false')
    formData.set('steps', JSON.stringify(steps))
    formAction(formData)
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={submit} className="flex flex-col gap-4" id={`edit-memo-${memo.id}`}>
        <input type="hidden" name="id" value={memo.id} />

        <div>
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" name="subject" required maxLength={200} defaultValue={memo.subject} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="departmentId" hint="optional">Department</Label>
            <Select id="departmentId" name="departmentId" defaultValue={memo.departmentId ?? ''} placeholder="None" options={departments} />
          </div>
          <div>
            <Label htmlFor="categoryId" hint="optional">Category</Label>
            <Select id="categoryId" name="categoryId" defaultValue={memo.categoryId ?? ''} placeholder="None" options={categories} />
          </div>
          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select
              id="priority" name="priority" defaultValue={memo.priority}
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
          <MemoEditor name="bodyHtml" initialHtml={memo.bodyHtml} />
        </div>

        <Section title="Workflow participants">
          {isDraft ? (
            <ParticipantSteps
              steps={steps} onChange={setSteps} activeUsers={activeUsers}
              templates={templates} designations={designations}
            />
          ) : (
            <>
              <ol className="flex flex-col gap-1.5">
                {participants.map((p, i) => (
                  <li
                    key={`${p.assigneeUserId}-${i}`}
                    className="flex items-center gap-2 rounded-[var(--radius-control)] border border-(--color-sand) bg-(--color-cream) px-3 py-2 text-[0.8125rem]"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-(--color-paper) font-mono-nums text-[0.6875rem] font-bold text-(--color-ink)/70">
                      {i + 1}
                    </span>
                    <span className="truncate font-bold">{p.positionTitle || `Step ${i + 1}`}</span>
                    <span className="truncate text-(--color-ink)/70">{p.assigneeName}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-1.5 text-[0.75rem] text-(--color-ink)/50">
                Resubmitting returns the memo to the participant who asked for changes. Add or remove
                people from the memo page once it is moving again.
              </p>
            </>
          )}
        </Section>
      </form>

      {/* Its own forms — attachments are added and removed as you go, not on save. */}
      <Section title="Attachments">
        <AttachmentList memoId={memo.id} attachments={attachments} canManage />
      </Section>

      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>

      <div className="flex flex-wrap items-center gap-3 border-t border-(--color-sand) pt-4">
        <Button
          type="submit" form={`edit-memo-${memo.id}`} variant="success"
          onClick={() => { publish.current = true }} disabled={pending}
        >
          {pending ? 'Working…' : isDraft ? 'Publish memo' : 'Republish memo'}
        </Button>
        <Button
          type="submit" form={`edit-memo-${memo.id}`} variant="gold"
          onClick={() => { publish.current = false }} disabled={pending}
        >
          Save draft
        </Button>
        <Button type="button" variant="danger" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>

        {isDraft ? (
          <form action={deleteAction} className="ml-auto">
            <input type="hidden" name="id" value={memo.id} />
            <Button type="submit" variant="danger-ghost" size="sm" disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete draft'}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  )
}
