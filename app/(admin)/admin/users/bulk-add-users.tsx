'use client'

import { useActionState, useMemo, useState } from 'react'
import { createUsersBulk, type BulkCreateState } from './actions'
import {
  validateBulkUsers, emptyDraft, isBlankDraft, BULK_MAX_ROWS, BULK_PASSWORD_MIN,
  type BulkUserDraft, type BulkRole,
} from './bulk-users'
import { Button } from '@/components/ui/button'
import { Input, Select, Label, FieldError } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'
import { ModalFormButton } from '@/components/ui/modal-form-button'
import { Badge } from '@/components/ui/badge'
import { IconClose } from '@/components/ui/icons'

type Option = { value: string; label: string }

const ROLE_OPTIONS: Option[] = [
  { value: 'user', label: 'Member' },
  { value: 'org_admin', label: 'Admin' },
]

export function BulkAddUsersButton({ departments }: { departments: Option[] }) {
  return (
    <ModalFormButton label="Bulk add" title="Add users in bulk" size="xl" variant="secondary">
      {(close) => <BulkAddUsersForm departments={departments} onDone={close} />}
    </ModalFormButton>
  )
}

function BulkAddUsersForm({ departments, onDone }: { departments: Option[]; onDone: () => void }) {
  const [rows, setRows] = useState<BulkUserDraft[]>([emptyDraft()])
  const [sharedPassword, setSharedPassword] = useState('')
  // Inline row errors only appear once a submit has been attempted, so the
  // form does not scold you for a half-typed email.
  const [attempted, setAttempted] = useState(false)
  const [state, formAction, pending] = useActionState<BulkCreateState, FormData>(createUsersBulk, undefined)

  // The same validator the action runs, so the count here matches the result.
  const check = useMemo(() => validateBulkUsers(rows), [rows])
  const errorFor = useMemo(() => {
    const m = new Map<number, string>()
    for (const e of check.errors) if (!m.has(e.index)) m.set(e.index, e.message)
    return m
  }, [check])

  const done = state && 'ok' in state && state.ok
  if (done) {
    return (
      <BulkResults
        created={state.created}
        sharedPassword={state.sharedPassword}
        failed={state.failed}
        onDone={onDone}
      />
    )
  }

  function update(i: number, patch: Partial<BulkUserDraft>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }
  function addRow() {
    setRows((r) => (r.length >= BULK_MAX_ROWS ? r : [...r, emptyDraft()]))
  }
  function removeRow(i: number) {
    setRows((r) => (r.length === 1 ? [emptyDraft()] : r.filter((_, idx) => idx !== i)))
  }

  return (
    <form
      action={formAction}
      onSubmit={() => setAttempted(true)}
      className="flex flex-col gap-4"
    >
      {/* only the rows worth submitting travel to the server */}
      <input type="hidden" name="users" value={JSON.stringify(check.valid.map((v) => v.draft))} />

      <div className="sm:max-w-xs">
        <Label htmlFor="sharedPassword" hint={`min. ${BULK_PASSWORD_MIN} characters`}>
          Temporary password
        </Label>
        <PasswordInput
          id="sharedPassword"
          name="sharedPassword"
          value={sharedPassword}
          onChange={(e) => setSharedPassword(e.target.value)}
          minLength={BULK_PASSWORD_MIN}
          autoComplete="new-password"
          placeholder="Shared by everyone in this batch"
          required
        />
        <p className="mt-1.5 text-[0.75rem] text-(--color-ink)/60">
          Everyone added here signs in with this once, then must choose their own.
        </p>
      </div>

      <div>
        <p className="mb-2 text-label uppercase text-(--color-ink)/60">Users</p>

        {/* column headings, once, where there is room for a real row */}
        <div className="hidden gap-2 pb-1.5 lg:grid lg:grid-cols-[1.1fr_1.4fr_1.1fr_1fr_0.8fr_auto]">
          {['Name', 'Email', 'Designation', 'Department', 'Role'].map((h) => (
            <span key={h} className="text-[0.6875rem] font-bold uppercase tracking-wide text-(--color-ink)/45">{h}</span>
          ))}
          <span className="w-9" />
        </div>

        <div className="flex flex-col gap-3 lg:gap-2">
          {rows.map((row, i) => {
            const err = attempted ? errorFor.get(i) : undefined
            return (
              <div key={i}>
                <div
                  className={
                    'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1.1fr_1.4fr_1.1fr_1fr_0.8fr_auto] lg:items-center ' +
                    // on narrow screens each row becomes its own card so the
                    // fields do not read as one long undifferentiated list
                    'rounded-[var(--radius-control)] border border-(--color-sand) p-3 lg:rounded-none lg:border-0 lg:p-0'
                  }
                >
                  <Input
                    aria-label={`Name, row ${i + 1}`} placeholder="Name" value={row.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    autoFocus={i === 0 && rows.length === 1}
                  />
                  <Input
                    aria-label={`Email, row ${i + 1}`} placeholder="email@org.com" type="email" value={row.email}
                    onChange={(e) => update(i, { email: e.target.value })}
                  />
                  <Input
                    aria-label={`Designation, row ${i + 1}`} placeholder="Designation" value={row.designation}
                    onChange={(e) => update(i, { designation: e.target.value })}
                  />
                  <Select
                    aria-label={`Department, row ${i + 1}`} placeholder="No department"
                    options={departments} value={row.departmentId}
                    onChange={(e) => update(i, { departmentId: e.target.value })}
                  />
                  <Select
                    aria-label={`Role, row ${i + 1}`} options={ROLE_OPTIONS} value={row.role}
                    onChange={(e) => update(i, { role: e.target.value as BulkRole })}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    aria-label={`Remove row ${i + 1}`}
                    title="Remove"
                    disabled={rows.length === 1 && isBlankDraft(row)}
                    className="flex size-9 shrink-0 items-center justify-center justify-self-end rounded-[var(--radius-dot)] text-(--color-ink)/50 transition-colors hover:bg-(--color-cream) hover:text-(--color-red-deep) disabled:pointer-events-none disabled:opacity-30"
                  >
                    <IconClose className="size-4" />
                  </button>
                </div>
                {err ? <p className="mt-1 text-[0.75rem] text-(--color-red-deep) lg:pl-1">Row {i + 1}: {err}</p> : null}
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= BULK_MAX_ROWS}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-(--color-orange-deep) hover:underline disabled:pointer-events-none disabled:opacity-50"
        >
          <span aria-hidden className="text-base leading-none">+</span> Add more
        </button>
        {rows.length >= BULK_MAX_ROWS ? (
          <p className="mt-1 text-[0.75rem] text-(--color-ink)/50">{BULK_MAX_ROWS} rows is the maximum per batch.</p>
        ) : null}
      </div>

      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.75rem] text-(--color-ink)/60">
          Everyone is prompted to set their own password when they first sign in.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
          <Button
            type="submit"
            disabled={pending || check.valid.length === 0 || sharedPassword.length < BULK_PASSWORD_MIN}
          >
            {pending
              ? 'Adding…'
              : `Add ${check.valid.length || ''} user${check.valid.length === 1 ? '' : 's'}`.replace('  ', ' ')}
          </Button>
        </div>
      </div>
    </form>
  )
}

function BulkResults({
  created, sharedPassword, failed, onDone,
}: {
  created: { name: string; email: string }[]
  sharedPassword: string
  failed: { row: number; email: string; message: string }[]
  onDone: () => void
}) {
  const [copied, setCopied] = useState(false)
  const asText = created.map((c) => `${c.name}\t${c.email}\t${sharedPassword}`).join('\n')

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
        {failed.length > 0 ? (
          <Badge className="border-(--color-red)/40 bg-(--color-red)/10 text-(--color-red-deep)">
            {failed.length} skipped
          </Badge>
        ) : null}
      </div>

      {created.length > 0 ? (
        <>
          <div className="rounded-[var(--radius-control)] border-2 border-(--color-gold-deep)/50 bg-(--color-gold)/10 p-3">
            <p className="text-label uppercase text-(--color-gold-deep)">Temporary password</p>
            <p className="mt-1 font-mono-nums text-lg font-bold text-(--color-ink)">{sharedPassword}</p>
            <p className="mt-1 text-[0.75rem] text-(--color-ink)/70">
              Share this with the people below. Each of them must choose their own password the first time they
              sign in.
            </p>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-label uppercase text-(--color-ink)/60">Accounts created</p>
              <Button type="button" size="sm" variant="secondary" onClick={copyAll}>
                {copied ? 'Copied' : 'Copy list'}
              </Button>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-[var(--radius-control)] border border-(--color-sand)">
              <table className="w-full border-collapse text-[0.8125rem]">
                <thead>
                  <tr className="bg-(--color-cream)">
                    <th className="px-3 py-2 text-left text-label uppercase text-(--color-ink)/60">Name</th>
                    <th className="px-3 py-2 text-left text-label uppercase text-(--color-ink)/60">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {created.map((c) => (
                    <tr key={c.email} className="border-t border-(--color-sand)">
                      <td className="px-3 py-2 text-(--color-ink)">{c.name}</td>
                      <td className="px-3 py-2 text-(--color-ink)">{c.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {failed.length > 0 ? (
        <div>
          <p className="mb-1.5 text-label uppercase text-(--color-ink)/60">Skipped</p>
          <ul className="flex flex-col gap-1">
            {failed.map((f) => (
              <li key={`${f.row}-${f.email}`} className="text-[0.75rem] text-(--color-red-deep)">
                Row {f.row}{f.email ? ` (${f.email})` : ''}: {f.message}
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
