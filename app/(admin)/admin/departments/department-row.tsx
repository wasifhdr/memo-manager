'use client'

import { useActionState, useState } from 'react'
import { renameDepartment, setDepartmentActive } from './actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'

type Department = { id: string; name: string; description: string | null; active: boolean }

export function DepartmentRow({ dept }: { dept: Department }) {
  const [editing, setEditing] = useState(false)
  const [renameState, renameFormAction, renamePending] = useActionState<ActionState, FormData>(
    (prev, fd) => renameDepartment(prev, fd).then((r) => { if (r?.ok) setEditing(false); return r }),
    undefined,
  )
  const [, toggleAction, togglePending] = useActionState<ActionState, FormData>(setDepartmentActive, undefined)

  if (editing) {
    return (
      <tr className="border-b border-(--color-sand)">
        <td className="px-4 py-3" colSpan={4}>
          <form action={renameFormAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={dept.id} />
            <Input name="name" defaultValue={dept.name} required className="max-w-[14rem] shrink-0" />
            <Input name="description" defaultValue={dept.description ?? ''} placeholder="Description (optional)" className="min-w-[12rem] flex-1" />
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button type="submit" size="sm" disabled={renamePending}>{renamePending ? 'Saving…' : 'Save'}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
          {renameState && 'error' in renameState && renameState.error ? (
            <p className="mt-1.5 text-[0.8125rem] text-(--color-red-deep)">{renameState.error}</p>
          ) : null}
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-(--color-sand) last:border-b-0">
      <td className="px-4 py-3 font-medium text-(--color-ink)">
        {dept.name}
        {dept.description ? (
          <div className="mt-0.5 text-[0.8125rem] font-normal text-(--color-ink)/60 md:hidden">{dept.description}</div>
        ) : null}
      </td>
      <td className="hidden px-4 py-3 text-(--color-ink)/70 md:table-cell">{dept.description || '—'}</td>
      <td className="px-4 py-3">
        {dept.active ? <Badge>Active</Badge> : <Badge className="opacity-70">Inactive</Badge>}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Rename
          </Button>
          <form action={toggleAction}>
            <input type="hidden" name="id" value={dept.id} />
            <input type="hidden" name="active" value={(!dept.active).toString()} />
            <Button type="submit" size="sm" variant="secondary" disabled={togglePending}>
              {dept.active ? 'Deactivate' : 'Activate'}
            </Button>
          </form>
        </div>
      </td>
    </tr>
  )
}
