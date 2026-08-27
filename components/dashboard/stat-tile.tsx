export function StatTile({ label, value, tone }: { label: string; value: number; tone?: 'default' | 'urgent' }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-(--border) bg-(--surface) px-4 py-3.5">
      <p className="font-mono-nums text-2xl font-semibold text-(--text)">
        {value}
        {tone === 'urgent' && value > 0 ? <span className="ml-1.5 inline-block size-2 rounded-full bg-(--pr-urgent-fg) align-middle" /> : null}
      </p>
      <p className="mt-0.5 text-[0.75rem] text-(--text-faint)">{label}</p>
    </div>
  )
}
