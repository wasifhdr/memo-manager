'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createUser, type CreateUserState } from './actions'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, FieldError } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'

export function NewUserForm({ departments }: { departments: { value: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState<CreateUserState, FormData>(createUser, undefined)
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const last = useRef<CreateUserState>(undefined)

  useEffect(() => {
    if (state && state !== last.current && 'ok' in state && state.ok) {
      setCredentials({ email: state.email, password: state.temporaryPassword })
      formRef.current?.reset()
    }
    last.current = state
  }, [state])

  return (
    <>
      <form ref={formRef} action={formAction} className="mb-6 grid gap-3 rounded-[var(--radius-lg)] border border-(--border) bg-(--surface) p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
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
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="role">Role</Label>
            <Select
              id="role" name="role" defaultValue="user"
              options={[{ value: 'user', label: 'Member' }, { value: 'org_admin', label: 'Admin' }]}
            />
          </div>
          <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add user'}</Button>
        </div>
        <div className="sm:col-span-2 lg:col-span-5">
          <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
        </div>
      </form>

      <Modal
        open={credentials !== null}
        onClose={() => setCredentials(null)}
        title="User created"
        footer={<Button onClick={() => setCredentials(null)}>Done</Button>}
      >
        {credentials ? (
          <div className="text-sm text-(--text)">
            <p className="mb-3 text-(--text-muted)">
              Share these credentials with the new user. This password is shown only once.
            </p>
            <dl className="space-y-2 rounded-[var(--radius-md)] bg-(--surface-sunken) p-3 font-mono-nums text-[0.8125rem]">
              <div className="flex justify-between gap-4">
                <dt className="text-(--text-faint)">Email</dt>
                <dd>{credentials.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-(--text-faint)">Password</dt>
                <dd>{credentials.password}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
