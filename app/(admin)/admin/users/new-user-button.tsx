'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ModalFormButton } from '@/components/ui/modal-form-button'
import { NewUserForm } from './new-user-form'

type Credentials = { email: string; password: string }

/**
 * Owns the two-step flow: the add-user modal, then the one-time credentials
 * modal that replaces it once the account exists.
 */
export function NewUserButton({ departments }: { departments: { value: string; label: string }[] }) {
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const dismiss = useCallback(() => setCredentials(null), [])

  return (
    <>
      <ModalFormButton label="Add user" title="Add a user" size="lg">
        {(close) => (
          <NewUserForm
            departments={departments}
            onCancel={close}
            onCreated={(c) => { close(); setCredentials(c) }}
          />
        )}
      </ModalFormButton>

      <Modal
        open={credentials !== null}
        onClose={dismiss}
        title="User created"
        footer={<Button onClick={dismiss}>Done</Button>}
      >
        {credentials ? (
          <div className="text-sm text-(--color-ink)">
            <p className="mb-3 text-(--color-ink)/70">
              Share these credentials with the new user. This password is shown only once.
            </p>
            <dl className="space-y-2 rounded-[var(--radius-control)] bg-(--color-cream) p-3 font-mono-nums text-[0.8125rem]">
              <div className="flex justify-between gap-4">
                <dt className="text-(--color-ink)/50">Email</dt>
                <dd>{credentials.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-(--color-ink)/50">Password</dt>
                <dd>{credentials.password}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
