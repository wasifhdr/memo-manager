'use client'

import { useActionState, useEffect, useRef } from 'react'
import { createDepartment } from './actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input, Label, FieldError } from '@/components/ui/field'
import { ModalFormButton } from '@/components/ui/modal-form-button'

export function NewDepartmentForm({ onDone }: { onDone?: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createDepartment, undefined)
  const ref = useRef<HTMLFormElement>(null)
  const last = useRef<ActionState>(undefined)

  useEffect(() => {
    if (state && state !== last.current && state.ok) {
      ref.current?.reset()
      onDone?.()
    }
    last.current = state
  }, [state, onDone])

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="new-dept-name">Name</Label>
        <Input id="new-dept-name" name="name" placeholder="e.g. Procurement" required autoFocus />
      </div>
      <div>
        <Label htmlFor="new-dept-desc" hint="optional">Description</Label>
        <Input id="new-dept-desc" name="description" placeholder="What this department covers" />
      </div>
      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add department'}</Button>
      </div>
    </form>
  )
}

/** Client wrapper: a server page cannot pass ModalFormButton's function child. */
export function NewDepartmentButton() {
  return (
    <ModalFormButton label="Add department" title="Add a department" size="md">
      {(close) => <NewDepartmentForm onDone={close} />}
    </ModalFormButton>
  )
}
