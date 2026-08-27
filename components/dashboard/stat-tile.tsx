import type { ComponentType, SVGProps } from 'react'

type Tone = 'default' | 'accent' | 'info' | 'review' | 'success' | 'danger' | 'urgent'

/** Badge tint per tone. The number only takes a semantic colour when the tone
 * is one where a non-zero count actually means something (urgent/danger/
 * success) — otherwise it stays ink so the row reads as one scale. */
const TONES: Record<Tone, { badge: string; value: string; semantic: boolean }> = {
  default: {
    badge: 'border-(--color-sand) bg-(--color-cream) text-(--color-ink)/60',
    value: 'text-(--color-ink)',
    semantic: false,
  },
  accent: {
    badge: 'border-(--color-orange)/40 bg-(--color-orange)/10 text-(--color-orange-deep)',
    value: 'text-(--color-ink)',
    semantic: false,
  },
  info: {
    badge: 'border-(--color-blue)/40 bg-(--color-blue)/10 text-(--color-blue-deep)',
    value: 'text-(--color-ink)',
    semantic: false,
  },
  review: {
    badge: 'border-(--color-purple)/40 bg-(--color-purple)/10 text-(--color-purple-deep)',
    value: 'text-(--color-ink)',
    semantic: false,
  },
  success: {
    badge: 'border-(--color-green)/40 bg-(--color-green)/10 text-(--color-green-deep)',
    value: 'text-(--color-green-deep)',
    semantic: true,
  },
  danger: {
    badge: 'border-(--color-red)/40 bg-(--color-red)/10 text-(--color-red-deep)',
    value: 'text-(--color-red-deep)',
    semantic: true,
  },
  urgent: {
    badge: 'border-(--color-red)/40 bg-(--color-red)/10 text-(--color-red-deep)',
    value: 'text-(--color-red-deep)',
    semantic: true,
  },
}

export function StatTile({
  label,
  value,
  tone = 'default',
  icon: Icon,
}: {
  label: string
  value: number
  tone?: Tone
  icon?: ComponentType<SVGProps<SVGSVGElement>>
}) {
  const t = TONES[tone]
  // A semantic tone only "lights up" when the count is non-zero — a zero
  // urgent count is good news and shouldn't read as an alarm.
  const valueClass = t.semantic && value > 0 ? t.value : 'text-(--color-ink)'

  return (
    <div className="rounded-[var(--radius-card)] border-2 border-(--color-ink) bg-(--color-paper) px-4 py-3.5 shadow-offset">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label uppercase text-(--color-ink)/70">{label}</p>
          <p className={`mt-1.5 font-mono-nums text-3xl font-bold leading-none ${valueClass}`}>{value}</p>
        </div>
        {Icon ? (
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-pill)] border ${t.badge}`}>
            {/* 1.3rem ≈ 18px × 1.15 — the glyph grows, the badge stays size-9 */}
            <Icon className="size-[1.3rem]" />
          </span>
        ) : null}
      </div>
    </div>
  )
}
