'use client'

import { useActionState } from 'react'
import { updateDraftAction, deleteDraftAction } from '@/app/(app)/memos/actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, FieldError } from '@/components/ui/field'
import { MemoEditor } from '@/components/memo/editor'
import { Card, CardBody } from '@/components/ui/card'
import type { Priority } from '@/db/schema'

type Option = { value: string; label: string }

export function EditMemoForm({
  memo, departments, categories, canDelete,
}: {
  memo: {
    id: string; subject: string; bodyHtml: string
    departmentId: string | null; categoryId: string | null; priority: Priority
  }
  departments: Option[]
  categories: Option[]
  canDelete: boolean
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateDraftAction, undefined)
  const [, deleteAction, deletePending] = useActionState<ActionState, FormData>(deleteDraftAction, undefined)

  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <form action={formAction} className="flex flex-col gap-4">
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

          <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save draft'}</Button>
          </div>
        </form>

        {canDelete ? (
          <form action={deleteAction} className="border-t border-(--color-sand) pt-4">
            <input type="hidden" name="id" value={memo.id} />
            <Button type="submit" variant="danger" size="sm" disabled={deletePending}>
              {deletePending ? 'Deleting…' : 'Delete draft'}
            </Button>
          </form>
        ) : null}
      </CardBody>
    </Card>
  )
}
