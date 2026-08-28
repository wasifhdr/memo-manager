'use client'

import { ModalFormButton } from '@/components/ui/modal-form-button'
import { NewMemoForm } from '@/components/memo/new-memo-form'
import type { ActiveUser, Template } from '@/components/memo/participant-picker'

type Option = { value: string; label: string }

/**
 * Opens the whole memo — fields, participants, attachments — in a modal over
 * the current page. The server action redirects to the new memo on success, so
 * only Cancel needs to close the dialog.
 */
export function NewMemoButton({
  departments,
  categories,
  activeUsers,
  templates,
  designations,
}: {
  departments: Option[]
  categories: Option[]
  activeUsers: ActiveUser[]
  templates: Template[]
  designations: string[]
}) {
  return (
    <ModalFormButton label="New memo" title="New memo" size="xl">
      {(close) => (
        <NewMemoForm
          departments={departments}
          categories={categories}
          activeUsers={activeUsers}
          templates={templates}
          designations={designations}
          onCancel={close}
        />
      )}
    </ModalFormButton>
  )
}
