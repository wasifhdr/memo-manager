'use client'

import { useActionState, useRef } from 'react'
import { createCategory } from './actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input, FieldError } from '@/components/ui/field'

export function NewCategoryForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createCategory, undefined)
  const ref = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={ref}
      action={(fd) => { formAction(fd); ref.current?.reset() }}
      className="mb-5 flex flex-wrap items-end gap-2"
    >
      <div>
        <label className="mb-1.5 block text-[0.8125rem] font-medium text-(--color-ink)" htmlFor="new-cat-name">
          New category
        </label>
        <Input id="new-cat-name" name="name" placeholder="Category name" required className="w-56" />
      </div>
      <Input name="description" placeholder="Description (optional)" className="w-64" />
      <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add category'}</Button>
      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
    </form>
  )
}
