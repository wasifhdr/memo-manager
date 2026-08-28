'use client'

import { useActionState, useState } from 'react'
import { workflowAction } from '@/app/(app)/memos/[id]/workflow-actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Textarea, FieldError } from '@/components/ui/field'
import { requiresReason } from '@/lib/decision-rules'

export function ActionPanel({
  memoId, canAct, actingForName, canComment,
}: {
  memoId: string
  canAct: boolean
  actingForName: string | null
  canComment: boolean
}) {
  if (!canAct && !canComment) return null

  return (
    <div className="flex flex-col gap-4">
      {canAct ? (
        <div className="rounded-[var(--radius-card)] border-2 border-(--color-gold-deep)/50 bg-(--color-gold)/10 p-4">
          <p className="mb-3 text-[0.8125rem] font-bold text-(--color-gold-deep)">
            {actingForName ? `You are acting on behalf of ${actingForName}.` : 'This memo is waiting on your decision.'}
          </p>
          <DecisionForm memoId={memoId} />
        </div>
      ) : null}

      {canComment ? <CommentForm memoId={memoId} /> : null}
    </div>
  )
}

/**
 * One comment box for all three decisions. The button that submits carries the
 * action, so there is no second prompt to fill in afterwards.
 */
function DecisionForm({ memoId }: { memoId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(workflowAction, undefined)
  const [comment, setComment] = useState('')

  // Same rule the server applies, from the same module, so the disabled button
  // and the validation cannot drift apart.
  const hasReason = comment.trim().length > 0
  const blocked = (action: string) => requiresReason(action) && !hasReason

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="memoId" value={memoId} />

      <Textarea
        name="comment"
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comment — optional to approve, required to reject or request changes"
        aria-label="Comment"
      />

      <div className="flex flex-wrap gap-2">
        {/* the submitter's name/value lands in the FormData, so each button
            carries its own action without a hidden field per decision */}
        <Button type="submit" name="action" value="approve" size="sm" disabled={pending}>
          {pending ? 'Submitting…' : 'Approve'}
        </Button>
        <Button
          type="submit" name="action" value="request_changes"
          variant="secondary" size="sm"
          disabled={pending || blocked('request_changes')}
          title={blocked('request_changes') ? 'Add a comment explaining what needs to change' : undefined}
        >
          Request changes
        </Button>
        <Button
          type="submit" name="action" value="reject"
          variant="danger" size="sm"
          disabled={pending || blocked('reject')}
          title={blocked('reject') ? 'Add a comment explaining the rejection' : undefined}
        >
          Reject
        </Button>
      </div>

      {!hasReason ? (
        <p className="text-[0.75rem] text-(--color-ink)/60">
          Rejecting or requesting changes needs a comment.
        </p>
      ) : null}

      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
    </form>
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
