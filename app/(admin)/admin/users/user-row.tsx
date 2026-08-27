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
      <tr className="border-b border-(--border)">
        <td className="px-4 py-3" colSpan={7}>
          <form action={updAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={user.id} />
            <Input name="name" defaultValue={user.name} required className="max-w-[12rem]" />
            <Input name="designation" defaultValue={user.designation ?? ''} placeholder="Designation" className="max-w-[12rem]" />
            <Select name="departmentId" defaultValue={user.departmentId ?? ''} placeholder="No department" options={departments} className="max-w-[12rem]" />
            <Select
              name="role" defaultValue={user.role} className="max-w-[10rem]"
              options={[{ value: 'user', label: 'Member' }, { value: 'org_admin', label: 'Admin' }]}
            />
            <Button type="submit" size="sm" disabled={updPending}>{updPending ? 'Saving…' : 'Save'}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </form>
          {updState && 'error' in updState && updState.error ? (
            <p className="mt-1.5 text-[0.8125rem] text-(--st-rejected-fg)">{updState.error}</p>
          ) : null}
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-(--border) last:border-b-0 align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-(--text)">{user.name}</div>
        <div className="text-[0.8125rem] text-(--text-faint)">{user.email}</div>
      </td>
      <td className="px-4 py-3 text-(--text-muted)">{user.designation || '—'}</td>
      <td className="px-4 py-3 text-(--text-muted)">{user.departmentName || '—'}</td>
      <td className="px-4 py-3">
        <Badge>{user.role === 'org_admin' ? 'Admin' : 'Member'}</Badge>
      </td>
      <td className="px-4 py-3">
        {user.status === 'active' ? <Badge>Active</Badge> : <Badge className="opacity-70">Inactive</Badge>}
      </td>
      <td className="px-4 py-3 text-(--text-faint)">
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
          <p className="mt-1.5 max-w-[16rem] text-right font-mono-nums text-[0.75rem] break-all text-(--accent)">
            {resetUrl}
          </p>
        ) : null}
      </td>
    </tr>
  )
}
