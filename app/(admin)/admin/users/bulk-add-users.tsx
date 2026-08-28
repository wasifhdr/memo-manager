'use client'

import { useActionState, useMemo, useState } from 'react'
import { createUsersBulk, type BulkCreateState } from './actions'
import { parseBulkUsers, BULK_CSV_TEMPLATE, BULK_MAX_ROWS } from './bulk-parse'
import { Button } from '@/components/ui/button'
import { Label, Textarea, FieldError } from '@/components/ui/field'
import { ModalFormButton } from '@/components/ui/modal-form-button'
import { Badge } from '@/components/ui/badge'

export function BulkAddUsersButton() {
  return (
    <ModalFormButton label="Bulk add" title="Add users in bulk" size="xl" variant="secondary">
      {(close) => <BulkAddUsersForm onDone={close} />}
    </ModalFormButton>
  )
}

function BulkAddUsersForm({ onDone }: { onDone: () => void }) {
  const [csv, setCsv] = useState('')
  const [state, formAction, pending] = useActionState<BulkCreateState, FormData>(createUsersBulk, undefined)

  // Same parser the action uses, so the preview cannot disagree with the result.
  const preview = useMemo(() => parseBulkUsers(csv), [csv])
  const done = state && 'ok' in state && state.ok

  if (done) return <BulkResults created={state.created} failed={state.failed} onDone={onDone} />

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="csv" hint={`up to ${BULK_MAX_ROWS} rows`}>
          One user per line
        </Label>
        <Textarea
          id="csv"
          name="csv"
          rows={9}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={BULK_CSV_TEMPLATE}
          className="font-mono-nums text-[0.8125rem]"
          autoFocus
        />
        <p className="mt-1.5 text-[0.75rem] text-(--color-ink)/60">
          <span className="font-bold">name, email, designation, department, role</span> — only name and email are
          required. Role is <span className="font-bold">admin</span> or <span className="font-bold">user</span>{' '}
          (default user). Department must match an existing department name. A header row is optional.
        </p>
        <button
          type="button"
          onClick={() => setCsv(BULK_CSV_TEMPLATE)}
          className="mt-1 text-[0.75rem] font-bold text-(--color-orange-deep) hover:underline"
        >
          Insert example
        </button>
      </div>

      {csv.trim() ? (
        <div className="rounded-[var(--radius-control)] border border-(--color-sand) bg-(--color-cream)/50 p-3">
          <p className="text-label uppercase text-(--color-ink)/60">Preview</p>
          <p className="mt-1 text-[0.8125rem] text-(--color-ink)">
            <span className="font-bold">{preview.rows.length}</span> user{preview.rows.length === 1 ? '' : 's'} ready
            {preview.errors.length > 0 ? (
              <> · <span className="font-bold text-(--color-red-deep)">{preview.errors.length}</span> line
                {preview.errors.length === 1 ? '' : 's'} skipped</>
            ) : null}
          </p>
          {preview.errors.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1">
              {preview.errors.slice(0, 6).map((e) => (
                <li key={`${e.line}-${e.message}`} className="text-[0.75rem] text-(--color-red-deep)">
                  Line {e.line}: {e.message}
                </li>
              ))}
              {preview.errors.length > 6 ? (
                <li className="text-[0.75rem] text-(--color-ink)/50">…and {preview.errors.length - 6} more</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending || preview.rows.length === 0}>
          {pending ? 'Adding…' : `Add ${preview.rows.length || ''} user${preview.rows.length === 1 ? '' : 's'}`.trim()}
        </Button>
      </div>
    </form>
  )
}

function BulkResults({
  created, failed, onDone,
}: {
  created: { name: string; email: string; temporaryPassword: string }[]
  failed: { line: number; email: string; message: string }[]
  onDone: () => void
}) {
  const [copied, setCopied] = useState(false)

  const asText = created.map((c) => `${c.name}\t${c.email}\t${c.temporaryPassword}`).join('\n')

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(asText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked — the list is on screen to copy by hand */ }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{created.length} created</Badge>
        {failed.length > 0 ? <Badge className="border-(--color-red)/40 bg-(--color-red)/10 text-(--color-red-deep)">{failed.length} skipped</Badge> : null}
      </div>

      {created.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[0.8125rem] text-(--color-ink)/70">
              These passwords are shown once. Copy them before closing.
            </p>
            <Button type="button" size="sm" variant="secondary" onClick={copyAll}>
              {copied ? 'Copied' : 'Copy all'}
            </Button>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-[var(--radius-control)] border border-(--color-sand)">
            <table className="w-full border-collapse text-[0.8125rem]">
              <thead>
                <tr className="bg-(--color-cream)">
                  <th className="px-3 py-2 text-left text-label uppercase text-(--color-ink)/60">Email</th>
                  <th className="px-3 py-2 text-left text-label uppercase text-(--color-ink)/60">Temporary password</th>
                </tr>
              </thead>
              <tbody>
                {created.map((c) => (
                  <tr key={c.email} className="border-t border-(--color-sand)">
                    <td className="px-3 py-2 text-(--color-ink)">{c.email}</td>
                    <td className="px-3 py-2 font-mono-nums text-(--color-ink)">{c.temporaryPassword}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {failed.length > 0 ? (
        <div>
          <p className="mb-1.5 text-label uppercase text-(--color-ink)/60">Skipped</p>
          <ul className="flex flex-col gap-1">
            {failed.map((f) => (
              <li key={`${f.line}-${f.email}`} className="text-[0.75rem] text-(--color-red-deep)">
                Line {f.line}{f.email ? ` (${f.email})` : ''}: {f.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" onClick={onDone}>Done</Button>
      </div>
    </div>
  )
}
