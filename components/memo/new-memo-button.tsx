'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { NewMemoForm } from '@/app/(app)/memos/new/new-memo-form'

type Option = { value: string; label: string }

/**
 * Opens the draft form in a modal over the current page. On success the
 * server action redirects to the new memo's edit screen, so there is no
 * client-side success handling to do here.
 */
export function NewMemoButton({
  departments,
  categories,
}: {
  departments: Option[]
  categories: Option[]
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <Button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        New memo
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New memo"
        size="xl"
        originRef={triggerRef}
      >
        <NewMemoForm departments={departments} categories={categories} bare />
      </Modal>
    </>
  )
}
