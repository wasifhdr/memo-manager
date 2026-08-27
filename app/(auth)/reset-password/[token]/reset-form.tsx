'use client'

import { useActionState } from 'react'
import { resetPasswordAction, type ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input, Label, FieldError } from '@/components/ui/field'

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    resetPasswordAction, undefined,
  )

  return (
    <form action={formAction} className="rounded-[var(--radius-card)] border border-(--color-sand) bg-(--color-paper) p-6 shadow-offset-sm">
      <h1 className="mb-1 font-display text-2xl font-bold text-(--color-ink)">Choose a new password</h1>
      <p className="mb-5 text-sm text-(--color-ink)/70">This link can only be used once.</p>

      <input type="hidden" name="token" value={token} />

      <div className="mb-4">
        <Label htmlFor="password" hint="min. 10 characters">New password</Label>
        <Input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" autoFocus />
      </div>
      <div className="mb-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input id="confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" />
      </div>

      <FieldError>{state?.error}</FieldError>

      <Button type="submit" disabled={pending} className="mt-4 w-full">
        {pending ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  )
}
