'use client'

import { useActionState, useRef } from 'react'
import { createDelegation, revokeDelegation } from './actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea, FieldError } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'

type Option = { value: string; label: string }

export function NewDelegationForm({ users }: { users: Option[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createDelegation, undefined)
  const ref = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={ref}
      action={(fd) => { formAction(fd); ref.current?.reset() }}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div>
        <Label htmlFor="delegateId">Delegate to</Label>
        <Select id="delegateId" name="delegateId" placeholder="Choose a user" options={users} required />
      </div>
      <div>
        <Label htmlFor="startDate">Start date</Label>
        <Input id="startDate" name="startDate" type="date" required />
      </div>
      <div>
        <Label htmlFor="endDate">End date</Label>
        <Input id="endDate" name="endDate" type="date" required />
      </div>
      <div>
        <Label htmlFor="reason" hint="optional">Reason</Label>
        <Input id="reason" name="reason" placeholder="e.g. annual leave" />
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
        <Button type="submit" size="sm" disabled={pending} className="mt-1">
          {pending ? 'Creating…' : 'Create delegation'}
        </Button>
      </div>
    </form>
  )
}

export function OutgoingRow({
  d,
}: {
  d: { id: string; delegateName: string; startAt: Date | string; endAt: Date | string; reason: string | null; status: string }
}) {
  const [, formAction, pending] = useActionState<ActionState, FormData>(revokeDelegation, undefined)
  const canRevoke = d.status === 'active' && new Date(d.endAt) > new Date()

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-medium text-(--color-ink)">{d.delegateName}</p>
        <p className="text-[0.75rem] text-(--color-ink)/50">
          {formatDate(d.startAt)} – {formatDate(d.endAt)}{d.reason ? ` · ${d.reason}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusChip status={d.status} endAt={d.endAt} />
        {canRevoke ? (
          <form action={formAction}>
            <input type="hidden" name="id" value={d.id} />
            <Button type="submit" size="sm" variant="ghost" disabled={pending}>Revoke</Button>
          </form>
        ) : null}
      </div>
    </li>
  )
}

export function IncomingRow({
  d,
}: {
  d: { id: string; delegatorName: string; startAt: Date | string; endAt: Date | string; reason: string | null; status: string }
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-medium text-(--color-ink)">{d.delegatorName}</p>
        <p className="text-[0.75rem] text-(--color-ink)/50">
          {formatDate(d.startAt)} – {formatDate(d.endAt)}{d.reason ? ` · ${d.reason}` : ''}
        </p>
      </div>
      <StatusChip status={d.status} endAt={d.endAt} />
    </li>
  )
}

function StatusChip({ status, endAt }: { status: string; endAt: Date | string }) {
  const expired = status === 'active' && new Date(endAt) <= new Date()
  if (status === 'revoked') return <Badge className="opacity-70">Revoked</Badge>
  if (expired) return <Badge className="opacity-70">Expired</Badge>
  return <Badge>Active</Badge>
}
