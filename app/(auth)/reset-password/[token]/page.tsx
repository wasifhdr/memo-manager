import type { Metadata } from 'next'
import { ResetPasswordForm } from './reset-form'

export const metadata: Metadata = { title: 'Reset password' }

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <ResetPasswordForm token={token} />
}
