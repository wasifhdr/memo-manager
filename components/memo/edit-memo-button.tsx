'use client'

import { ModalFormButton } from '@/components/ui/modal-form-button'
import { EditMemoForm } from '@/components/memo/edit-memo-form'
import type { AttachmentItem } from '@/components/memo/attachment-list'
import type { ActiveUser, Step, Template } from '@/components/memo/participant-picker'
import type { ComponentProps } from 'react'
import type { Priority } from '@/db/schema'

type Option = { value: string; label: string }

/**
 * Opens the memo for editing in a modal over the memo page. The server action
 * redirects on success, so only Cancel needs to close the dialog.
 */
export function EditMemoButton({
  label, variant, memo, departments, categories, attachments, participants, activeUsers, templates, designations,
}: {
  label: string
  variant?: ComponentProps<typeof ModalFormButton>['variant']
  memo: {
    id: string; subject: string; bodyHtml: string
    departmentId: string | null; categoryId: string | null; priority: Priority
    status: 'draft' | 'changes_requested'
  }
  departments: Option[]
  categories: Option[]
  attachments: AttachmentItem[]
  participants: { assigneeUserId: string; positionTitle: string; requiredAction: Step['requiredAction']; assigneeName: string }[]
  activeUsers: ActiveUser[]
  templates: Template[]
  designations: string[]
}) {
  return (
    <ModalFormButton label={label} title={memo.status === 'draft' ? 'Edit memo' : 'Revise memo'} size="xl" variant={variant}>
      {(close) => (
        <EditMemoForm
          memo={memo}
          departments={departments}
          categories={categories}
          attachments={attachments}
          participants={participants}
          activeUsers={activeUsers}
          templates={templates}
          designations={designations}
          onCancel={close}
        />
      )}
    </ModalFormButton>
  )
}
