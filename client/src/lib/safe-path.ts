/**
 * Chỉ nhận đường dẫn nội bộ ("/b/123") cho ?next= — chống open redirect.
 * Chặn cả "//evil.com" và "/\evil.com" (trình duyệt coi "\" như "/").
 * File không import gì để middleware (Edge runtime) dùng được.
 */
export function isSafeNextPath(next: string | null | undefined): next is string {
  return !!next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\');
}
