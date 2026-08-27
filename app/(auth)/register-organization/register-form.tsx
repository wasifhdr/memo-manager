'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { registerOrganizationAction, type ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input, Label, FieldError } from '@/components/ui/field'

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    registerOrganizationAction, undefined,
  )

  return (
    <form action={formAction} className="rounded-[var(--radius-lg)] border border-(--border) bg-(--surface) p-6 shadow-[var(--shadow-sm)]">
      <h1 className="mb-1 text-xl font-semibold text-(--text) font-serif-heading">Register your organization</h1>
      <p className="mb-5 text-sm text-(--text-muted)">
        This creates your organization and its first administrator account.
      </p>

      <fieldset className="mb-5 flex flex-col gap-4">
        <legend className="mb-1 text-[0.75rem] font-semibold uppercase tracking-wide text-(--text-faint)">
          Organization
        </legend>
        <div>
          <Label htmlFor="orgName">Organization name</Label>
          <Input id="orgName" name="orgName" required placeholder="Northbridge University" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="orgCode" hint="e.g. memo prefix">Short code</Label>
            <Input id="orgCode" name="orgCode" required placeholder="NBU" maxLength={12} />
          </div>
          <div>
            <Label htmlFor="contactEmail" hint="optional">Contact email</Label>
            <Input id="contactEmail" name="contactEmail" type="email" placeholder="office@nbu.edu" />
          </div>
        </div>
      </fieldset>

      <fieldset className="mb-5 flex flex-col gap-4">
        <legend className="mb-1 text-[0.75rem] font-semibold uppercase tracking-wide text-(--text-faint)">
          Administrator account
        </legend>
        <div>
          <Label htmlFor="adminName">Your name</Label>
          <Input id="adminName" name="adminName" required autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="adminEmail">Your email</Label>
          <Input id="adminEmail" name="adminEmail" type="email" required autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="password" hint="min. 10 characters">Password</Label>
          <Input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" />
        </div>
      </fieldset>

      <FieldError>{state?.error}</FieldError>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? 'Creating organization…' : 'Create organization'}
      </Button>

      <p className="mt-5 text-center text-[0.8125rem] text-(--text-muted)">
        Already have an account?{' '}
        <Link href="/login" className="text-(--accent) hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
