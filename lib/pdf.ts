import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { htmlToText } from '@/lib/sanitize'
import type { MemoDetail } from '@/lib/repo/memo'

type OrgInfo = { name: string; code: string; contactEmail: string | null; contactPhone: string | null; address: string | null }

const PAGE_W = 612 // US Letter, points
const PAGE_H = 792
const MARGIN = 56
const INK = rgb(0.09, 0.10, 0.13)
const MUTED = rgb(0.34, 0.36, 0.42)
const FAINT = rgb(0.53, 0.55, 0.6)
const ACCENT = rgb(0.14, 0.33, 0.84)

const STATUS_LABEL: Record<string, string> = {
  draft: 'DRAFT', submitted: 'SUBMITTED', pending_review: 'IN PROGRESS — PENDING REVIEW',
  pending_approval: 'IN PROGRESS — PENDING APPROVAL', changes_requested: 'IN PROGRESS — CHANGES REQUESTED',
  rejected: 'REJECTED', approved: 'APPROVED', cancelled: 'CANCELLED',
}
const STATUS_COLOR: Record<string, ReturnType<typeof rgb>> = {
  approved: rgb(0.12, 0.48, 0.30), rejected: rgb(0.64, 0.15, 0.12),
  cancelled: rgb(0.46, 0.47, 0.52),
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

function fmt(d: Date | string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

class Writer {
  doc!: PDFDocument
  page!: PDFPage
  y = PAGE_H - MARGIN
  regular!: PDFFont
  bold!: PDFFont

  async init() {
    this.doc = await PDFDocument.create()
    this.regular = await this.doc.embedFont(StandardFonts.Helvetica)
    this.bold = await this.doc.embedFont(StandardFonts.HelveticaBold)
    this.newPage()
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H])
    this.y = PAGE_H - MARGIN
  }

  ensure(space: number) {
    if (this.y - space < MARGIN) this.newPage()
  }

  text(str: string, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number; x?: number } = {}) {
    const size = o.size ?? 10
    const font = o.font ?? this.regular
    const maxWidth = PAGE_W - MARGIN * 2 - (o.x ? o.x - MARGIN : 0)
    const lines = wrap(str, font, size, maxWidth)
    for (const line of lines) {
      this.ensure(size + 4)
      this.page.drawText(line, { x: o.x ?? MARGIN, y: this.y, size, font, color: o.color ?? INK })
      this.y -= size + 4
    }
    this.y -= o.gap ?? 0
  }

  heading(str: string) {
    this.ensure(24)
    this.y -= 6
    this.page.drawLine({
      start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y },
      thickness: 0.75, color: rgb(0.85, 0.86, 0.89),
    })
    this.y -= 14
    this.text(str.toUpperCase(), { size: 9.5, font: this.bold, color: MUTED, gap: 4 })
  }

  kv(label: string, value: string) {
    this.ensure(14)
    this.page.drawText(label, { x: MARGIN, y: this.y, size: 9, font: this.bold, color: MUTED })
    this.page.drawText(value || '—', { x: MARGIN + 110, y: this.y, size: 9.5, font: this.regular, color: INK })
    this.y -= 15
  }
}

/**
 * Renders one memo as a PDF: organization header, metadata, body, attachment
 * references, workflow participants, approval history, comments, and a
 * prominent final-status stamp. §20.
 */
export async function buildMemoPdf(detail: NonNullable<MemoDetail>, org: OrgInfo): Promise<Uint8Array> {
  const w = new Writer()
  await w.init()
  const { memo, cycles, events, thread, attachments } = detail

  // Header
  w.text(org.name, { size: 16, font: w.bold, gap: 2 })
  const contactLine = [org.code, org.contactEmail, org.contactPhone, org.address].filter(Boolean).join('  ·  ')
  if (contactLine) w.text(contactLine, { size: 8.5, color: FAINT, gap: 10 })
  else w.y -= 8

  // Status stamp
  const stampColor = STATUS_COLOR[memo.status] ?? ACCENT
  w.ensure(30)
  w.page.drawRectangle({ x: MARGIN, y: w.y - 22, width: 220, height: 24, color: stampColor, opacity: 0.12 })
  w.page.drawText(STATUS_LABEL[memo.status] ?? memo.status.toUpperCase(), {
    x: MARGIN + 8, y: w.y - 16, size: 10.5, font: w.bold, color: stampColor,
  })
  w.y -= 34

  w.heading('Memo')
  w.kv('Memo number', memo.memoNumber)
  w.kv('Subject', memo.subject)
  w.kv('Author', memo.authorName)
  w.kv('Department', memo.departmentName ?? '—')
  w.kv('Category', memo.categoryName ?? '—')
  w.kv('Priority', memo.priority)
  w.kv('Created', fmt(memo.createdAt))
  w.kv('Submitted', fmt(memo.submittedAt))
  if (memo.completedAt) w.kv('Completed', fmt(memo.completedAt))
  w.y -= 4

  w.heading('Body')
  w.text(htmlToText(memo.bodyHtml) || '(No content)', { size: 10, gap: 4 })

  if (attachments.length > 0) {
    w.heading('Attachments')
    for (const a of attachments) {
      w.text(`${a.filename}  (${(a.sizeBytes / 1024).toFixed(1)} KB) — uploaded by ${a.uploadedByName}, ${fmt(a.createdAt)}`, { size: 9, gap: 2 })
    }
  }

  const currentCycleSteps = cycles.find((c) => c.cycle === memo.currentCycle)?.steps ?? cycles.at(-1)?.steps ?? []
  if (currentCycleSteps.length > 0) {
    w.heading('Workflow participants')
    for (const s of currentCycleSteps) {
      w.text(`${s.stepNo}. ${s.positionTitle ?? ''} — ${s.assigneeName}`, { size: 9.5, gap: 2 })
    }
  }

  // The export keeps the full record: workflow history and thread comments,
  // which the screen separates, are one chronological list here.
  const history = [...events, ...thread]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  w.heading('Approval history & comments')
  if (history.length === 0) {
    w.text('No recorded activity.', { size: 9.5, color: FAINT })
  }
  for (const e of history) {
    const who = e.onBehalfOfName ? `${e.actorName ?? 'System'} (on behalf of ${e.onBehalfOfName})` : (e.actorName ?? 'System')
    w.text(`${fmt(e.createdAt)} — ${who}: ${e.type.replace(/_/g, ' ')}${e.detail ? ` — ${e.detail}` : ''}`, {
      size: 9, font: w.bold, gap: 1,
    })
    if (e.comment) w.text(`"${e.comment}"`, { size: 9, color: MUTED, x: MARGIN + 12, gap: 3 })
  }

  return w.doc.save()
}
