import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/tenant'
import { ChangePasswordForm } from './change-password-form'

export const metadata: Metadata = { title: 'Choose a password' }

export default async function ChangePasswordPage() {
  // The gate is lifted here — this is the one page a gated user may reach.
  const ctx = await requireSession({ allowPendingPasswordChange: true })
  // Nobody who has already chosen a password needs this screen.
  if (!ctx.user.mustChangePassword) redirect('/dashboard')

  return <ChangePasswordForm email={ctx.user.email} />
}
