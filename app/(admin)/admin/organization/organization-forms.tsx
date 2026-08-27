'use client'

import { useActionState, useEffect, useRef } from 'react'
import { updateOrganization, uploadLogo } from './actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input, Label, FieldError } from '@/components/ui/field'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

type Org = {
  name: string; code: string; memoPrefix: string
  contactEmail: string | null; contactPhone: string | null; address: string | null
}

export function OrganizationProfileForm({ org }: { org: Org }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateOrganization, undefined)
  const toast = useToast()
  const last = useRef<ActionState>(undefined)

  useEffect(() => {
    if (state && state !== last.current && state.ok) toast.success('Organization updated.')
    last.current = state
  }, [state, toast])

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold">Organization profile</h2>
      </CardHeader>
      <CardBody>
        <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Organization name</Label>
            <Input id="name" name="name" defaultValue={org.name} required />
          </div>
          <div>
            <Label htmlFor="code">Short code</Label>
            <Input id="code" name="code" defaultValue={org.code} required maxLength={12} />
          </div>
          <div>
            <Label htmlFor="memoPrefix" hint="used in memo numbers">Memo prefix</Label>
            <Input id="memoPrefix" name="memoPrefix" defaultValue={org.memoPrefix} required maxLength={12} />
          </div>
          <div>
            <Label htmlFor="contactEmail" hint="optional">Contact email</Label>
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={org.contactEmail ?? ''} />
          </div>
          <div>
            <Label htmlFor="contactPhone" hint="optional">Contact phone</Label>
            <Input id="contactPhone" name="contactPhone" defaultValue={org.contactPhone ?? ''} />
          </div>
          <div>
            <Label htmlFor="address" hint="optional">Address</Label>
            <Input id="address" name="address" defaultValue={org.address ?? ''} />
          </div>
          <div className="sm:col-span-2">
            <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
            <Button type="submit" disabled={pending} size="sm" className="mt-1">
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

export function LogoUploadForm({ hasLogo }: { hasLogo: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(uploadLogo, undefined)
  const toast = useToast()
  const last = useRef<ActionState>(undefined)

  useEffect(() => {
    if (state && state !== last.current && state.ok) toast.success('Logo updated.')
    last.current = state
  }, [state, toast])

  return (
    <Card className="mt-6">
      <CardHeader>
        <h2 className="text-sm font-semibold">Logo</h2>
      </CardHeader>
      <CardBody>
        <div className="flex items-center gap-4">
          {hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/api/org-logo" alt="" className="size-14 rounded-[var(--radius-control)] border border-(--color-sand) object-contain" />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-[var(--radius-control)] border border-dashed border-(--color-ink) text-[0.6875rem] text-(--color-ink)/50">
              None
            </div>
          )}
          <form action={formAction} className="flex flex-1 flex-wrap items-center gap-2">
            <input
              type="file" name="logo" accept="image/png,image/jpeg,image/svg+xml"
              className="flex-1 text-[0.8125rem] text-(--color-ink)/70 file:mr-3 file:rounded-[var(--radius-control)] file:border-0 file:bg-(--color-cream) file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-medium file:text-(--color-ink)"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              {pending ? 'Uploading…' : 'Upload'}
            </Button>
          </form>
        </div>
        <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
        <p className="mt-2 text-[0.75rem] text-(--color-ink)/50">PNG, JPEG or SVG, up to 512 KB.</p>
      </CardBody>
    </Card>
  )
}
