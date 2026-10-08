import { APP_VERSION } from '../app/version.ts'
import { supabase } from './client.ts'

export interface MistakeReport {
  subjectId: string
  topicId: string
  itemKind: 'question' | 'step'
  itemId: string
  seenIn: 'lesson' | 'quiz' | 'worksheet'
  note: string
  /**
   * A generated question has the written one's id but different words, so the generator and
   * seed go with the note: without them the reviewer would read a question the student never saw.
   */
  generated?: { generatorId: string; seed: string }
}

/**
 * Sends a "Report a mistake" note. The reporter is filled in by the database from the
 * signed-in account, so the app cannot send one in anybody else's name. Resolves to false
 * when there is nowhere to send it (a device-only build) or the insert fails, including on
 * a deployment where the table's migration has not been applied yet.
 */
export async function sendReport(r: MistakeReport): Promise<boolean> {
  if (!supabase) return false
  const typed = r.note.trim()
  if (!typed) return false
  // The address is kept whole: a long note is cut, not the line that says what was seen.
  const note = r.generated ? `${typed.slice(0, 880)}\n\n(Generated question: ${r.generated.generatorId}, seed ${r.generated.seed})` : typed.slice(0, 1000)
  const { error } = await supabase.from('content_reports').insert({
    subject_id: r.subjectId, topic_id: r.topicId, item_kind: r.itemKind, item_id: r.itemId,
    seen_in: r.seenIn, note, app_version: APP_VERSION,
  })
  return !error
}

export interface ContentReport {
  id: string
  reporter_email: string
  subject_id: string
  topic_id: string
  item_kind: 'question' | 'step'
  item_id: string
  seen_in: 'lesson' | 'quiz' | 'worksheet'
  note: string
  app_version: string
  status: 'open' | 'fixed' | 'not-a-fault'
  created_at: string
}

/** Reports for a parent to review, newest first; empty when there are none or no table yet. */
export async function listReports(): Promise<ContentReport[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('content_reports').select('*').order('created_at', { ascending: false }).limit(200)
  return error || !data ? [] : (data as ContentReport[])
}

export async function setReportStatus(id: string, status: ContentReport['status']): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('content_reports').update({ status }).eq('id', id)
  return !error
}

/*
 * Errors on the family's devices, reported without any identity. A page that throws in a
 * loop would otherwise send hundreds of rows, so each message is sent once per session and
 * at most ten are sent in all.
 */
const sent = new Set<string>()
const MAX_PER_SESSION = 10
let signedIn = false

/** Only a signed-in family member's device may write; before that, errors are dropped. */
export function setErrorReportingSignedIn(on: boolean) {
  signedIn = on
}

export function reportError(error: unknown, where?: string) {
  if (!supabase || !signedIn) return
  const page = where ?? (typeof location === 'undefined' ? '' : location.pathname + location.search)
  const e = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error))
  const message = (e.message || 'Unknown error').slice(0, 500)
  if (sent.has(message) || sent.size >= MAX_PER_SESSION) return
  sent.add(message)
  void supabase.from('client_errors').insert({
    message,
    stack: e.stack?.slice(0, 4000) ?? null,
    page: page.slice(0, 300),
    app_version: APP_VERSION,
    user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent.slice(0, 300),
  })
}

/** Catches what escapes React: script errors and promises nobody handled. */
export function installErrorReporting() {
  window.addEventListener('error', (ev) => reportError(ev.error ?? ev.message))
  window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason))
}
