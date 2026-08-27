'use client'

import { useActionState, useRef } from 'react'
import { uploadAttachmentAction, deleteAttachmentAction } from '@/app/(app)/memos/actions'
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MAX_PER_MEMO } from '@/lib/attachment-limits'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { IconPaperclip, IconClose } from '@/components/ui/icons'

export type AttachmentItem = {
  id: string
  filename: string
  sizeBytes: number
  uploadedByName: string
  createdAt: Date | string
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentList({
  memoId, attachments, canManage = false,
}: {
  memoId: string
  attachments: AttachmentItem[]
  canManage?: boolean
}) {
  return (
    <div>
      {attachments.length === 0 ? (
        <p className="text-[0.8125rem] text-(--color-ink)/50">No attachments yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {attachments.map((a) => (
            <AttachmentRow key={a.id} memoId={memoId} attachment={a} canManage={canManage} />
          ))}
        </ul>
      )}
      {canManage && attachments.length < ATTACHMENT_MAX_PER_MEMO ? (
        <UploadAttachmentForm memoId={memoId} />
      ) : null}
    </div>
  )
}

function AttachmentRow({
  memoId, attachment, canManage,
}: {
  memoId: string
  attachment: AttachmentItem
  canManage: boolean
}) {
  const [, deleteAction, pending] = useActionState<ActionState, FormData>(deleteAttachmentAction, undefined)

  return (
    <li className="flex items-center gap-2 rounded-[var(--radius-control)] border border-(--color-sand) bg-(--color-paper) px-3 py-2 text-[0.8125rem]">
      <IconPaperclip className="size-3.5 shrink-0 text-(--color-ink)/50" />
      <a
        href={`/api/attachments/${attachment.id}`}
        className="min-w-0 flex-1 truncate font-medium text-(--color-ink) hover:text-(--color-orange-deep)"
      >
        {attachment.filename}
      </a>
      <span className="shrink-0 font-mono-nums text-(--color-ink)/50">{formatBytes(attachment.sizeBytes)}</span>
      <span className="hidden shrink-0 text-(--color-ink)/50 sm:inline">{attachment.uploadedByName}</span>
      {canManage ? (
        <form action={deleteAction}>
          <input type="hidden" name="memoId" value={memoId} />
          <input type="hidden" name="attachmentId" value={attachment.id} />
          <button
            type="submit"
            disabled={pending}
            aria-label={`Remove ${attachment.filename}`}
            className="flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-dot)] text-(--color-ink)/50 hover:bg-(--color-cream) hover:text-(--color-red-deep)"
          >
            <IconClose className="size-3.5" />
          </button>
        </form>
      ) : null}
    </li>
  )
}

function UploadAttachmentForm({ memoId }: { memoId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(uploadAttachmentAction, undefined)
  const ref = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={ref}
      action={(fd) => { formAction(fd); ref.current?.reset() }}
      className="mt-2.5 flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="memoId" value={memoId} />
      <input
        type="file" name="file" required
        className="flex-1 text-[0.8125rem] text-(--color-ink)/70 file:mr-3 file:rounded-[var(--radius-dot)] file:border-0 file:bg-(--color-cream) file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-bold file:text-(--color-ink)"
      />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? 'Uploading…' : 'Attach'}
      </Button>
      <div className="w-full">
        <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
        <p className="mt-1 text-[0.75rem] text-(--color-ink)/50">
          Up to {(ATTACHMENT_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB per file, {ATTACHMENT_MAX_PER_MEMO} files per memo.
        </p>
      </div>
    </form>
  )
}
