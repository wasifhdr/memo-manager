/** "3d 4h", "5h 12m", "just now" — for inbox age and similar relative times. */
export function formatAge(date: Date | string | null): string {
  if (!date) return '—'
  const ms = Date.now() - new Date(date).getTime()
  if (ms < 60_000) return 'just now'
  const minutes = Math.floor(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  return `${minutes}m`
}

export function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "7:01 PM" — the clock half of a timestamp, when the date is written separately. */
export function formatTimeOfDay(date: Date | string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
