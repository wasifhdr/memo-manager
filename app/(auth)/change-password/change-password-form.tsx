'use client'

import { useActionState } from 'react'
import { completePasswordChange } from './actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Label, FieldError } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'

export function ChangePasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(completePasswordChange, undefined)

  return (
    <form action={formAction} className="rounded-[var(--radius-card)] border border-(--color-sand) bg-(--color-paper) p-6 shadow-offset-sm">
      <h1 className="mb-1 font-display text-2xl font-bold text-(--color-ink)">Choose your password</h1>
      <p className="mb-5 text-sm text-(--color-ink)/70">
        Your account was set up with a password chosen by an administrator. Pick your own to continue as{' '}
        <span className="font-bold text-(--color-ink)">{email}</span>.
      </p>

      <div className="mb-4">
        <Label htmlFor="currentPassword">Password you signed in with</Label>
        <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required autoFocus />
      </div>

      <div className="mb-4">
        <Label htmlFor="newPassword" hint="min. 10 characters">New password</Label>
        <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" minLength={10} required />
      </div>

      <div className="mb-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={10} required />
      </div>

      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>

      <Button type="submit" disabled={pending} className="mt-5 w-full">
        {pending ? 'Saving…' : 'Save and continue'}
      </Button>

      <p className="mt-4 text-center text-[0.75rem] text-(--color-ink)/50">
        Saving signs you out of any other device.
      </p>
    </form>
  )
}
