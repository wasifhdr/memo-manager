'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { requestPasswordResetAction, type ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/field'

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    requestPasswordResetAction, undefined,
  )

  if (state?.ok) {
    return (
      <div className="rounded-[var(--radius-card)] border border-(--color-sand) bg-(--color-paper) p-6 shadow-offset-sm">
        <h1 className="mb-1 font-display text-2xl font-bold text-(--color-ink)">Check with your administrator</h1>
        <p className="text-sm text-(--color-ink)/70">
          If that address belongs to an active account, a reset link has been generated. This
          deployment has no outbound email — ask your organization administrator for the link,
          or find it in the server log.
        </p>
        <Link href="/login" className="mt-5 inline-block text-[0.8125rem] text-(--color-orange-deep) hover:underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="rounded-[var(--radius-card)] border border-(--color-sand) bg-(--color-paper) p-6 shadow-offset-sm">
      <h1 className="mb-1 font-display text-2xl font-bold text-(--color-ink)">Reset your password</h1>
      <p className="mb-5 text-sm text-(--color-ink)/70">Enter the email on your account.</p>

      <div className="mb-4">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoFocus autoComplete="email" />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>

      <p className="mt-5 text-center text-[0.8125rem] text-(--color-ink)/70">
        <Link href="/login" className="text-(--color-orange-deep) hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  )
}
