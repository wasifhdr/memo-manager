'use client'

import { ModalFormButton } from '@/components/ui/modal-form-button'
import { TemplateForm } from './template-form'

export function NewTemplate() {
  return (
    <ModalFormButton label="New template" title="New workflow template" size="xl">
      {(close) => <TemplateForm mode="create" onDone={close} />}
    </ModalFormButton>
  )
}
