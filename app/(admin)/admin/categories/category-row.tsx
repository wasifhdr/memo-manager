'use client'

import { useActionState, useState } from 'react'
import { updateCategory, setCategoryActive } from './actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'

type Category = { id: string; name: string; description: string | null; active: boolean }

export function CategoryRow({ cat }: { cat: Category }) {
  const [editing, setEditing] = useState(false)
  const [updateState, updateFormAction, updatePending] = useActionState<ActionState, FormData>(
    (prev, fd) => updateCategory(prev, fd).then((r) => { if (r?.ok) setEditing(false); return r }),
    undefined,
  )
  const [, toggleAction, togglePending] = useActionState<ActionState, FormData>(setCategoryActive, undefined)

  if (editing) {
    return (
      <tr className="border-b border-(--color-sand)">
        <td className="px-4 py-3" colSpan={4}>
          <form action={updateFormAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={cat.id} />
            <Input name="name" defaultValue={cat.name} required className="max-w-[14rem] shrink-0" />
            <Input name="description" defaultValue={cat.description ?? ''} placeholder="Description (optional)" className="min-w-[12rem] flex-1" />
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button type="submit" size="sm" disabled={updatePending}>{updatePending ? 'Saving…' : 'Save'}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
          {updateState && 'error' in updateState && updateState.error ? (
            <p className="mt-1.5 text-[0.8125rem] text-(--color-red-deep)">{updateState.error}</p>
          ) : null}
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-(--color-sand) last:border-b-0">
      <td className="px-4 py-3 font-medium text-(--color-ink)">{cat.name}</td>
      <td className="px-4 py-3 text-(--color-ink)/70">{cat.description || '—'}</td>
      <td className="px-4 py-3">
        {cat.active ? <Badge>Active</Badge> : <Badge className="opacity-70">Inactive</Badge>}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
          <form action={toggleAction}>
            <input type="hidden" name="id" value={cat.id} />
            <input type="hidden" name="active" value={(!cat.active).toString()} />
            <Button type="submit" size="sm" variant="secondary" disabled={togglePending}>
              {cat.active ? 'Deactivate' : 'Activate'}
            </Button>
          </form>
        </div>
      </td>
    </tr>
  )
}
