import type { WorksheetLevel } from '@study/shared'

/**
 * A generated worksheet's code: the seed its questions are drawn from, short enough to read
 * off a printed sheet or type into a message. The same code always rebuilds the same
 * questions and answers, which is what lets a sheet be printed now and marked next week, or
 * sent to someone else and opened with the same numbers.
 *
 * No 0, o, 1, i or l: a code read off paper must not be ambiguous.
 */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function newSheetCode(): string {
  return [...crypto.getRandomValues(new Uint8Array(6))].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}

/**
 * The code in a link, if it is one. Attempt ids (the first seeds, before codes) are accepted
 * as well, so a sheet from an early retry can still be printed.
 */
export function sheetParam(params: URLSearchParams): string | undefined {
  const code = params.get('sheet')?.trim().toLowerCase()
  return code && /^[a-z0-9-]{4,40}$/.test(code) ? code : undefined
}

/** Where a generated sheet lives: on screen, or as its printable page. */
export function sheetPath(subjectId: string, topicId: string, level: WorksheetLevel, code: string, print = false, answers = false): string {
  return `/subjects/${subjectId}/topics/${topicId}/worksheet/${level}${print ? '/print' : ''}?sheet=${code}${answers ? '&answers=1' : ''}`
}
