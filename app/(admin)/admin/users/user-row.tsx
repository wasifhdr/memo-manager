'use client'

import { useActionState, useState } from 'react'
import { updateUser, setUserStatus, generateResetLink, type ResetLinkState } from './actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'

export type UserRowData = {
  id: string
  name: string
  email: string
  designation: string | null
  role: 'org_admin' | 'user'
  status: 'active' | 'inactive'
  departmentId: string | null
  departmentName: string | null
  lastLoginAt: Date | null
}

export function UserRow({
  user, departments, isSelf,
}: {
  user: UserRowData
  departments: { value: string; label: string }[]
  isSelf: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [resetUrl, setResetUrl] = useState<string | null>(null)

  const [updState, updAction, updPending] = useActionState<ActionState, FormData>(
    (prev, fd) => updateUser(prev, fd).then((r) => { if (r?.ok) setEditing(false); return r }),
    undefined,
  )
  const [, statusAction, statusPending] = useActionState<ActionState, FormData>(setUserStatus, undefined)
  const [, resetAction, resetPending] = useActionState<ResetLinkState, FormData>(
    (_prev, fd) => generateResetLink(_prev, fd).then((r) => { if (r && 'ok' in r) setResetUrl(r.url); return r }),
    undefined,
  )

  if (editing) {
    return (
      <tr className="border-b border-(--color-sand)">
        <td className="px-4 py-3" colSpan={7}>
          <form action={updAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={user.id} />
            <Input name="name" defaultValue={user.name} required className="max-w-[12rem] shrink-0" />
            <Input name="designation" defaultValue={user.designation ?? ''} placeholder="Designation" className="min-w-[10rem] flex-1" />
            <Select name="departmentId" defaultValue={user.departmentId ?? ''} placeholder="No department" options={departments} className="max-w-[12rem]" />
            <Select
              name="role" defaultValue={user.role} className="max-w-[10rem]"
              options={[{ value: 'user', label: 'Member' }, { value: 'org_admin', label: 'Admin' }]}
            />
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button type="submit" size="sm" disabled={updPending}>{updPending ? 'Saving…' : 'Save'}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
          {updState && 'error' in updState && updState.error ? (
            <p className="mt-1.5 text-[0.8125rem] text-(--color-red-deep)">{updState.error}</p>
          ) : null}
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-(--color-sand) last:border-b-0">
      <td className="px-4 py-3">
        <div className="font-medium text-(--color-ink)">{user.name}</div>
        <div className="text-[0.8125rem] text-(--color-ink)/50">{user.email}</div>
        {/* Columns hidden on narrow screens fold back in here so nothing is lost. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
          <Badge>{user.role === 'org_admin' ? 'Admin' : 'Member'}</Badge>
          {user.status === 'active' ? <Badge>Active</Badge> : <Badge className="opacity-70">Inactive</Badge>}
        </div>
        {user.designation || user.departmentName ? (
          <div className="mt-1 text-[0.8125rem] text-(--color-ink)/70 lg:hidden">
            {[user.designation, user.departmentName].filter(Boolean).join(' · ')}
          </div>
        ) : null}
      </td>
      <td className="hidden px-4 py-3 text-(--color-ink)/70 lg:table-cell">{user.designation || '—'}</td>
      <td className="hidden px-4 py-3 text-(--color-ink)/70 lg:table-cell">{user.departmentName || '—'}</td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <Badge>{user.role === 'org_admin' ? 'Admin' : 'Member'}</Badge>
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        {user.status === 'active' ? <Badge>Active</Badge> : <Badge className="opacity-70">Inactive</Badge>}
      </td>
      <td className="hidden px-4 py-3 text-(--color-ink)/50 xl:table-cell">
        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
          <form action={statusAction}>
            <input type="hidden" name="id" value={user.id} />
            <input type="hidden" name="status" value={user.status === 'active' ? 'inactive' : 'active'} />
            <Button type="submit" size="sm" variant="secondary" disabled={statusPending || isSelf}>
              {user.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
          </form>
          <form action={resetAction}>
            <input type="hidden" name="id" value={user.id} />
            <Button type="submit" size="sm" variant="ghost" disabled={resetPending}>Reset link</Button>
          </form>
        </div>
        {resetUrl ? (
          <p className="mt-1.5 max-w-[16rem] text-right font-mono-nums text-[0.75rem] break-all text-(--color-orange-deep)">
            {resetUrl}
          </p>
        ) : null}
      </td>
    </tr>
  )
}
