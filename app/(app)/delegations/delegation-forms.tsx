'use client'

import { useActionState, useEffect, useRef } from 'react'
import { createDelegation, revokeDelegation } from './actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea, FieldError } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { ModalFormButton } from '@/components/ui/modal-form-button'
import { formatDate } from '@/lib/format'

type Option = { value: string; label: string }

export function NewDelegationForm({ users, onDone }: { users: Option[]; onDone?: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createDelegation, undefined)
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
    <form ref={ref} action={formAction} className="grid gap-4 sm:grid-cols-2">
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
      <div className="sm:col-span-2">
        <Label htmlFor="reason" hint="optional">Reason</Label>
        <Input id="reason" name="reason" placeholder="e.g. annual leave" />
      </div>
      <div className="sm:col-span-2">
        <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Create delegation'}
          </Button>
        </div>
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

/** Client wrapper: a server page cannot pass ModalFormButton's function child. */
export function NewDelegationButton({ users }: { users: Option[] }) {
  return (
    <ModalFormButton label="New delegation" title="Delegate your authority" size="lg">
      {(close) => <NewDelegationForm users={users} onDone={close} />}
    </ModalFormButton>
  )
}
