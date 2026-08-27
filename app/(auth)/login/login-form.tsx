'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { loginAction, type ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input, Label, FieldError } from '@/components/ui/field'

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loginAction, undefined)

  return (
    <form action={formAction} className="rounded-[var(--radius-lg)] border border-(--border) bg-(--surface) p-6 shadow-[var(--shadow-sm)]">
      <h1 className="mb-1 text-xl font-semibold text-(--text) font-serif-heading">Sign in</h1>
      <p className="mb-5 text-sm text-(--text-muted)">Enter your workspace credentials.</p>

      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="mb-4">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>

      <div className="mb-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-[0.8125rem] text-(--accent) hover:underline">
            Forgot password?
          </Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>

      <FieldError>{state?.error}</FieldError>

      <Button type="submit" disabled={pending} className="mt-5 w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>

      <p className="mt-5 text-center text-[0.8125rem] text-(--text-muted)">
        New organization?{' '}
        <Link href="/register-organization" className="text-(--accent) hover:underline">
          Register it here
        </Link>
      </p>
    </form>
  )
}
