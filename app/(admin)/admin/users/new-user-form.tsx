'use client'

import { useActionState, useEffect, useRef } from 'react'
import { createUser, type CreateUserState } from './actions'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, FieldError } from '@/components/ui/field'

export function NewUserForm({
  departments,
  onCreated,
  onCancel,
}: {
  departments: { value: string; label: string }[]
  /** Fires with the one-time credentials so the caller can reveal them. */
  onCreated?: (credentials: { email: string; password: string }) => void
  onCancel?: () => void
}) {
  const [state, formAction, pending] = useActionState<CreateUserState, FormData>(createUser, undefined)
  const formRef = useRef<HTMLFormElement>(null)
  const last = useRef<CreateUserState>(undefined)

  useEffect(() => {
    if (state && state !== last.current && 'ok' in state && state.ok) {
      formRef.current?.reset()
      onCreated?.({ email: state.email, password: state.temporaryPassword })
    }
    last.current = state
  }, [state, onCreated])

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required autoFocus />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="designation" hint="optional">Designation</Label>
        <Input id="designation" name="designation" />
      </div>
      <div>
        <Label htmlFor="departmentId" hint="optional">Department</Label>
        <Select id="departmentId" name="departmentId" placeholder="None" options={departments} />
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <Select
          id="role" name="role" defaultValue="user"
          options={[{ value: 'user', label: 'Member' }, { value: 'org_admin', label: 'Admin' }]}
        />
      </div>
      <div className="sm:col-span-2">
        <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add user'}</Button>
        </div>
      </div>
    </form>
  )
}
