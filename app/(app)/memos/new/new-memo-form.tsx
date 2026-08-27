'use client'

import { useActionState } from 'react'
import { createDraftAction } from '@/app/(app)/memos/actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, FieldError } from '@/components/ui/field'
import { MemoEditor } from '@/components/memo/editor'
import { Card, CardBody } from '@/components/ui/card'

type Option = { value: string; label: string }

export function NewMemoForm({
  departments, categories,
}: {
  departments: Option[]
  categories: Option[]
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createDraftAction, undefined)

  return (
    <form action={formAction}>
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" required maxLength={200} placeholder="What is this memo about?" autoFocus />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
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

          <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>

          <div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Save draft'}
            </Button>
            <p className="mt-2 text-[0.75rem] text-(--text-faint)">
              You will add workflow participants and attachments on the next screen.
            </p>
          </div>
        </CardBody>
      </Card>
    </form>
  )
}
