/** StatChip — the design system's signature inverse stat treatment (ink
 * ground, paper numerals) per D:/DESIGN.md §5. `tone="urgent"` calls out a
 * count that needs the viewer's attention with a pulsing gold dot. */
export function StatTile({ label, value, tone }: { label: string; value: number; tone?: 'default' | 'urgent' }) {
  const urgent = tone === 'urgent' && value > 0
  return (
    <div className="rounded-[var(--radius-card)] bg-(--color-ink) px-5 py-3.5 text-(--color-paper)">
      <p className={`flex items-center gap-1.5 font-mono-nums text-2xl font-bold ${urgent ? 'text-(--color-gold)' : 'text-(--color-paper)'}`}>
        {value}
        {urgent ? <span className="inline-block size-2 shrink-0 animate-pulse rounded-[var(--radius-pill)] bg-(--color-gold)" /> : null}
      </p>
      <p className="mt-0.5 text-[0.75rem] text-(--color-cream)/70">{label}</p>
    </div>
  )
}
