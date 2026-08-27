'use client'

import { ModalFormButton } from '@/components/ui/modal-form-button'
import { NewMemoForm } from '@/app/(app)/memos/new/new-memo-form'

type Option = { value: string; label: string }

/**
 * Opens the draft form in a modal over the current page. The server action
 * redirects to the new memo on success, so there is no close handling here.
 */
export function NewMemoButton({
  departments,
  categories,
}: {
  departments: Option[]
  categories: Option[]
}) {
  return (
    <ModalFormButton label="New memo" title="New memo" size="xl">
      {() => <NewMemoForm departments={departments} categories={categories} bare />}
    </ModalFormButton>
  )
}
