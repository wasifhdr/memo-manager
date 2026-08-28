'use client'

import { useActionState, useState } from 'react'
import { setTemplateActive } from './actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { TemplateForm } from './template-form'
import type { RequiredAction } from '@/db/schema'

type Template = {
  id: string
  name: string
  description: string | null
  active: boolean
  steps: { positionTitle: string; requiredAction: RequiredAction }[]
}

export function TemplateCard({ template, designations }: { template: Template; designations: string[] }) {
  const [editing, setEditing] = useState(false)
  const [, toggleAction, togglePending] = useActionState<ActionState, FormData>(setTemplateActive, undefined)

  return (
    <Card>
      <CardHeader>
        <div>
          <h3 className="text-sm font-semibold text-(--color-ink)">{template.name}</h3>
          {template.description ? <p className="mt-0.5 text-[0.75rem] text-(--color-ink)/70">{template.description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {template.active ? <Badge>Active</Badge> : <Badge className="opacity-70">Inactive</Badge>}
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Close' : 'Edit'}
          </Button>
          <form action={toggleAction}>
            <input type="hidden" name="id" value={template.id} />
            <input type="hidden" name="active" value={(!template.active).toString()} />
            <Button type="submit" size="sm" variant="secondary" disabled={togglePending}>
              {template.active ? 'Deactivate' : 'Activate'}
            </Button>
          </form>
        </div>
      </CardHeader>
      <CardBody>
        {editing ? (
          <TemplateForm mode="edit" template={template} designations={designations} onDone={() => setEditing(false)} />
        ) : (
          <ol className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-(--color-ink)/70">
            {template.steps.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="rounded-[var(--radius-control)] border border-(--color-sand) bg-(--color-cream) px-2 py-1">
                  {s.positionTitle} <span className="text-(--color-ink)/50">({s.requiredAction})</span>
                </span>
                {i < template.steps.length - 1 ? <span className="text-(--color-ink)/50">→</span> : null}
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  )
}
