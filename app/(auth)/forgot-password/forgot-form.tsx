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
      <div className="rounded-[var(--radius-lg)] border border-(--border) bg-(--surface) p-6 shadow-[var(--shadow-sm)]">
        <h1 className="mb-1 text-xl font-semibold text-(--text) font-serif-heading">Check with your administrator</h1>
        <p className="text-sm text-(--text-muted)">
          If that address belongs to an active account, a reset link has been generated. This
          deployment has no outbound email — ask your organization administrator for the link,
          or find it in the server log.
        </p>
        <Link href="/login" className="mt-5 inline-block text-[0.8125rem] text-(--accent) hover:underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="rounded-[var(--radius-lg)] border border-(--border) bg-(--surface) p-6 shadow-[var(--shadow-sm)]">
      <h1 className="mb-1 text-xl font-semibold text-(--text) font-serif-heading">Reset your password</h1>
      <p className="mb-5 text-sm text-(--text-muted)">Enter the email on your account.</p>

      <div className="mb-4">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoFocus autoComplete="email" />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>

      <p className="mt-5 text-center text-[0.8125rem] text-(--text-muted)">
        <Link href="/login" className="text-(--accent) hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  )
}
