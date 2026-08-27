'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { TemplateForm } from './template-form'

export function NewTemplate() {
  const [open, setOpen] = useState(false)
  if (!open) return <Button size="sm" onClick={() => setOpen(true)}>New template</Button>

  return (
    <Card className="mb-2">
      <CardBody>
        <TemplateForm mode="create" onDone={() => setOpen(false)} />
      </CardBody>
    </Card>
  )
}
