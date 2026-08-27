'use client'

import { useActionState, useRef } from 'react'
import { createDepartment } from './actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { FieldError } from '@/components/ui/field'

export function NewDepartmentForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createDepartment, undefined)
  const ref = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={ref}
      action={(fd) => { formAction(fd); ref.current?.reset() }}
      className="mb-5 flex flex-wrap items-end gap-2"
    >
      <div>
        <label className="mb-1.5 block text-[0.8125rem] font-medium text-(--text)" htmlFor="new-dept-name">
          New department
        </label>
        <Input id="new-dept-name" name="name" placeholder="Department name" required className="w-56" />
      </div>
      <Input name="description" placeholder="Description (optional)" className="w-64" />
      <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add department'}</Button>
      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
    </form>
  )
}
