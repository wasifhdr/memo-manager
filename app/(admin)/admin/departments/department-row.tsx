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
      <tr className="border-b border-(--border)">
        <td className="px-4 py-3" colSpan={4}>
          <form action={renameFormAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={dept.id} />
            <Input name="name" defaultValue={dept.name} required className="max-w-[14rem]" />
            <Input name="description" defaultValue={dept.description ?? ''} placeholder="Description (optional)" className="max-w-[18rem]" />
            <Button type="submit" size="sm" disabled={renamePending}>{renamePending ? 'Saving…' : 'Save'}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </form>
          {renameState && 'error' in renameState && renameState.error ? (
            <p className="mt-1.5 text-[0.8125rem] text-(--st-rejected-fg)">{renameState.error}</p>
          ) : null}
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-(--border) last:border-b-0">
      <td className="px-4 py-3 font-medium text-(--text)">{dept.name}</td>
      <td className="px-4 py-3 text-(--text-muted)">{dept.description || '—'}</td>
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
