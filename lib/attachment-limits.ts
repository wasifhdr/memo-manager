// Plain constants — kept out of any 'use server' file, since such files may
// only export async functions.
export const ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024
export const ATTACHMENT_MAX_PER_MEMO = 10

/**
 * How many bytes of attachments one request may carry. Files that each pass the
 * per-file check can still exceed the request ceiling together — Next's
 * serverActions.bodySizeLimit, and under it whatever the host allows (4.5 MB on
 * Vercel) — which the platform answers with a bare 413 the app cannot dress up.
 * Staying below it leaves room for the memo body travelling in the same request.
 */
export const ATTACHMENT_MAX_REQUEST_BYTES = 4 * 1024 * 1024

export function overRequestBudget(sizes: number[]): boolean {
  return sizes.reduce((total, n) => total + n, 0) > ATTACHMENT_MAX_REQUEST_BYTES
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
export const ALLOWED_MIME: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
}
