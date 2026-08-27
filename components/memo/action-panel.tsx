'use client'

import { useActionState, useState } from 'react'
import { workflowAction } from '@/app/(app)/memos/[id]/workflow-actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Textarea, FieldError } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import type { RequiredAction } from '@/db/schema'

export function ActionPanel({
  memoId, canAct, requiredAction, actingForName, canComment,
}: {
  memoId: string
  canAct: boolean
  requiredAction: RequiredAction | null
  actingForName: string | null
  canComment: boolean
}) {
  if (!canAct && !canComment) return null

  return (
    <div className="flex flex-col gap-4">
      {canAct && requiredAction ? (
        <div className="rounded-[var(--radius-card)] border-2 border-(--color-gold-deep)/50 bg-(--color-gold)/10 p-4">
          <p className="mb-3 text-[0.8125rem] font-bold text-(--color-gold-deep)">
            {actingForName ? `You are acting on behalf of ${actingForName}.` : 'This memo is waiting on your decision.'}
          </p>
          <DecisionForm memoId={memoId} requiredAction={requiredAction} />
        </div>
      ) : null}

      {canComment ? <CommentForm memoId={memoId} /> : null}
    </div>
  )
}

function DecisionForm({ memoId, requiredAction }: { memoId: string; requiredAction: RequiredAction }) {
  const [approveState, approveAction, approvePending] = useActionState<ActionState, FormData>(workflowAction, undefined)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [changesOpen, setChangesOpen] = useState(false)
  const approveLabel = requiredAction === 'review' ? 'Complete review' : 'Approve'
  const approveActionValue = requiredAction === 'review' ? 'complete_review' : 'approve'

  return (
    <>
      <form action={approveAction} className="flex flex-col gap-2">
        <input type="hidden" name="memoId" value={memoId} />
        <input type="hidden" name="action" value={approveActionValue} />
        <Textarea name="comment" placeholder="Optional comment" rows={2} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={approvePending} size="sm">
            {approvePending ? 'Submitting…' : approveLabel}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setChangesOpen(true)}>
            Request changes
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={() => setRejectOpen(true)}>
            Reject
          </Button>
        </div>
        <FieldError>{approveState && 'error' in approveState ? approveState.error : undefined}</FieldError>
      </form>

      <ReasonModal
        open={rejectOpen} onClose={() => setRejectOpen(false)}
        memoId={memoId} action="reject" title="Reject this memo"
        description="This ends the workflow. A reason is required."
        confirmLabel="Reject memo" confirmVariant="danger"
      />
      <ReasonModal
        open={changesOpen} onClose={() => setChangesOpen(false)}
        memoId={memoId} action="request_changes" title="Request changes"
        description="The memo returns to the author for revision. Explain what needs to change."
        confirmLabel="Request changes" confirmVariant="primary"
      />
    </>
  )
}

function ReasonModal({
  open, onClose, memoId, action, title, description, confirmLabel, confirmVariant,
}: {
  open: boolean
  onClose: () => void
  memoId: string
  action: 'reject' | 'request_changes'
  title: string
  description: string
  confirmLabel: string
  confirmVariant: 'primary' | 'danger'
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    (prev, fd) => workflowAction(prev, fd).then((r) => { if (r?.ok) onClose(); return r }),
    undefined,
  )
  const [comment, setComment] = useState('')

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="memoId" value={memoId} />
        <input type="hidden" name="action" value={action} />
        <p className="text-[0.8125rem] text-(--color-ink)/70">{description}</p>
        <Textarea
          name="comment" required rows={4} autoFocus
          value={comment} onChange={(e) => setComment(e.target.value)}
          placeholder="Explain your decision…"
        />
        <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={confirmVariant} size="sm" disabled={pending || !comment.trim()}>
            {pending ? 'Submitting…' : confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function CommentForm({ memoId }: { memoId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    (prev, fd) => workflowAction(prev, fd).then((r) => { if (r?.ok) setText(''); return r }),
    undefined,
  )
  const [text, setText] = useState('')

  return (
    <form action={formAction} className="rounded-[var(--radius-card)] border border-(--color-sand) bg-(--color-paper) p-4">
      <p className="mb-2 text-[0.8125rem] font-bold text-(--color-ink)">Add a comment</p>
      <input type="hidden" name="memoId" value={memoId} />
      <input type="hidden" name="action" value="comment" />
      <Textarea
        name="comment" rows={2} placeholder="Share a note on this memo…"
        value={text} onChange={(e) => setText(e.target.value)}
      />
      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
      <div className="mt-2">
        <Button type="submit" size="sm" variant="secondary" disabled={pending || !text.trim()}>
          {pending ? 'Posting…' : 'Post comment'}
        </Button>
      </div>
    </form>
  )
}
