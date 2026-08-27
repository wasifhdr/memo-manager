'use client'

import { useActionState } from 'react'
import { updateProfileAction, changePasswordAction } from './actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input, Label, FieldError } from '@/components/ui/field'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useEffect, useRef } from 'react'

export function EditProfileForm({ name, designation }: { name: string; designation: string | null }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateProfileAction, undefined)
  const toast = useToast()
  const last = useRef<ActionState>(undefined)

  useEffect(() => {
    if (state && state !== last.current && state.ok) toast.success('Profile updated.')
    last.current = state
  }, [state, toast])

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold">Profile</h2>
      </CardHeader>
      <CardBody>
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={name} required />
          </div>
          <div>
            <Label htmlFor="designation" hint="optional">Designation</Label>
            <Input id="designation" name="designation" defaultValue={designation ?? ''} />
          </div>
          <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
          <div>
            <Button type="submit" disabled={pending} size="sm">
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(changePasswordAction, undefined)
  const toast = useToast()
  const formRef = useRef<HTMLFormElement>(null)
  const last = useRef<ActionState>(undefined)

  useEffect(() => {
    if (state && state !== last.current && state.ok) {
      toast.success('Password changed. Other sessions were signed out.')
      formRef.current?.reset()
    }
    last.current = state
  }, [state, toast])

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold">Change password</h2>
      </CardHeader>
      <CardBody>
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="currentPassword">Current password</Label>
            <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
          </div>
          <div>
            <Label htmlFor="newPassword" hint="min. 10 characters">New password</Label>
            <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={10} required />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
          </div>
          <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
          <p className="text-[0.75rem] text-(--color-ink)/50">
            Changing your password signs you out everywhere else.
          </p>
          <div>
            <Button type="submit" disabled={pending} size="sm">
              {pending ? 'Updating…' : 'Update password'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
