'use client'

import { useActionState, useState } from 'react'
import { submitAction, resubmitAction, cancelAction } from './workflow-actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Select, Textarea, FieldError, Label } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'

export function SubmitControl({ memoId }: { memoId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(submitAction, undefined)
  return (
    <form action={formAction} className="flex flex-col items-start gap-1.5">
      <input type="hidden" name="memoId" value={memoId} />
      <Button type="submit" disabled={pending}>{pending ? 'Submitting…' : 'Submit for approval'}</Button>
      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
    </form>
  )
}

export function ResubmitControl({ memoId }: { memoId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(resubmitAction, undefined)
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="memoId" value={memoId} />
      <div>
        <Label htmlFor="mode" hint="where the workflow continues">Resubmit</Label>
        <Select
          id="mode" name="mode" defaultValue="resume"
          options={[
            { value: 'resume', label: 'Resume at the reviewer who requested changes' },
            { value: 'restart', label: 'Restart from the first participant' },
          ]}
          className="w-96 max-w-full"
        />
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Resubmitting…' : 'Resubmit'}</Button>
      <div className="w-full">
        <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
      </div>
    </form>
  )
}

export function CancelControl({ memoId }: { memoId: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    (prev, fd) => cancelAction(prev, fd).then((r) => { if (r?.ok) setOpen(false); return r }),
    undefined,
  )

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>Cancel memo</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Cancel this memo">
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="memoId" value={memoId} />
          <p className="text-[0.8125rem] text-(--text-muted)">
            The workflow ends immediately. This cannot be undone.
          </p>
          <Textarea name="reason" rows={3} placeholder="Reason (optional)" />
          <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Keep memo</Button>
            <Button type="submit" variant="danger" size="sm" disabled={pending}>
              {pending ? 'Cancelling…' : 'Cancel memo'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
