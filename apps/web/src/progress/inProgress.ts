/**
 * Unfinished quizzes, worksheets and redo sessions, kept on the device so a student comes
 * back to the same question with their answers (UXI-2).
 *
 * They lived in session storage, which a phone clears when the tab or the installed app is
 * closed: a worksheet half done on the bus was gone by the evening. Local storage keeps
 * them, with an age limit so old work does not come back forever: an unfinished session for
 * a week, a finished one for an hour (long enough that a refresh still shows its result).
 */
const OPEN_FOR_MS = 7 * 24 * 3600_000
const DONE_FOR_MS = 3600_000

interface Stored<T> { savedAt: string; state: T }

export function loadInProgress<T extends { finishedAt?: string }>(key: string, now = Date.now()): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { savedAt, state } = JSON.parse(raw) as Stored<T>
    const age = now - Date.parse(savedAt)
    if (!state || !(age >= 0) || age > (state.finishedAt ? DONE_FOR_MS : OPEN_FOR_MS)) {
      localStorage.removeItem(key)
      return null
    }
    return state
  } catch {
    return null
  }
}

export function saveInProgress<T>(key: string, state: T | null, now = Date.now()) {
  try {
    if (state) localStorage.setItem(key, JSON.stringify({ savedAt: new Date(now).toISOString(), state } satisfies Stored<T>))
    else localStorage.removeItem(key)
  } catch {
    // Storage full or blocked: the session still works until the page is closed.
  }
}

/** An unfinished session saved under this key, and how far it got, for a Resume button. */
export function openSession(key: string, now = Date.now()): { index: number; total: number } | null {
  const s = loadInProgress<{ finishedAt?: string; index?: number; questionIds?: string[]; items?: unknown[] }>(key, now)
  if (!s || s.finishedAt) return null
  return { index: s.index ?? 0, total: s.questionIds?.length ?? s.items?.length ?? 0 }
}

export const quizKey = (topicId: string) => `study-companion.quiz.${topicId}`
export const worksheetKey = (topicId: string, level: string) => `study-companion.worksheet.${topicId}.${level}`
export const MISTAKES_KEY = 'study-companion.mistakes'
