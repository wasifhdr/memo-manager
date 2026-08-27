import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/tenant'
import { listVersions, getVersion, getMemoDetail } from '@/lib/repo/memo'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime } from '@/lib/format'

export const metadata: Metadata = { title: 'Memo Versions' }

export default async function MemoVersionsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireSession()

  const detail = await getMemoDetail(ctx, id)
  if (!detail) notFound()

  const summaries = await listVersions(ctx, id)
  if (!summaries) notFound()
  const versions = await Promise.all(summaries.map((s) => getVersion(ctx, id, s.versionNo)))

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Version history"
        eyebrow={<span>{detail.memo.memoNumber}</span>}
        description={detail.memo.subject}
      />

      {versions.length === 0 ? (
        <EmptyState title="No versions yet" description="A version is created each time this memo is submitted or resubmitted." />
      ) : (
        <div className="flex flex-col gap-3">
          {versions.filter((v) => v !== null).reverse().map((v) => (
            <details key={v.versionNo} className="rounded-[var(--radius-lg)] border border-(--border) bg-(--surface)" open={v.versionNo === versions.length}>
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-[0.8125rem] font-medium text-(--text)">
                <span>Version {v.versionNo} — {v.subject}</span>
                <span className="font-mono-nums text-[0.75rem] font-normal text-(--text-faint)">
                  {v.editorName} · {formatDateTime(v.submittedAt ?? v.createdAt)}
                </span>
              </summary>
              <div className="border-t border-(--border) px-4 py-4">
                <div className="prose-memo" dangerouslySetInnerHTML={{ __html: v.bodyHtml }} />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
