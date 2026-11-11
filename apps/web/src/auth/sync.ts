import { supabase } from './client.ts'
import { getState, replaceState, subscribe, type ProgressState } from '../progress/store.ts'
import { mergeProgress } from '../progress/merge.ts'

let unsubscribe: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let applyingRemote = false
/** The account sync is running for, so a retry after a lost signal knows whose it is. */
let current: { userId: string; email: string; displayName?: string } | null = null
/** A save that failed and waits for the signal to return. */
let unsaved = false
/** A retry is already waiting, so failed saves in a row do not pile up retries. */
let retrying = false

/** How long to wait before trying again when the signal seems to be there but a request failed. */
const RETRY_MS = 30_000

/** The retry waiting for a signal, cancelled by stopSync so a signed-out account is never synced. */
let cancelRetry: (() => void) | null = null

function retryWhenOnline(run: () => void) {
  cancelRetry?.()
  const cancel = () => { window.removeEventListener('online', again); clearTimeout(t); cancelRetry = null }
  const again = () => { cancel(); run() }
  const t = setTimeout(again, RETRY_MS)
  window.addEventListener('online', again)
  cancelRetry = cancel
}

/**
 * Keeps this account's progress row in step with the device. On start, the row and
 * the device state are merged (nothing is lost either way) and both are updated;
 * after that every local change is saved a moment later.
 *
 * Without a signal (UXI-5) the row cannot be read, and the device's copy must not be written
 * over it, or attempts made on another device since would be lost. So nothing is saved until
 * the row has been read and merged: work done offline stays on the device, and goes up with
 * the merge when the signal returns.
 */
export async function startSync(userId: string, email: string, displayName?: string) {
  if (!supabase) return
  stopSync()
  current = { userId, email, displayName }
  const { data, error } = await supabase.from('user_progress').select('state').eq('user_id', userId).maybeSingle()
  if (current?.userId !== userId) return
  if (error) {
    retryWhenOnline(() => { if (current?.userId === userId && !unsubscribe) void startSync(userId, email, displayName) })
    return
  }
  const remote = (data?.state ?? null) as Partial<ProgressState> | null
  const merged = remote ? mergeProgress(getState(), remote) : getState()
  applyingRemote = true
  replaceState(merged)
  applyingRemote = false
  unsubscribe = subscribe(() => {
    if (applyingRemote) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void save(userId, email, getState(), displayName), 1500)
  })
  await save(userId, email, merged, displayName)
}

/**
 * The display name rides along with the progress. It is how a parent gets to see a name
 * rather than an email address on the Family screen, and writing it here means nobody
 * has to type it: whoever signs in supplies their own.
 */
async function save(userId: string, email: string, state: ProgressState, displayName?: string) {
  if (!supabase) return
  const row: Record<string, unknown> = { user_id: userId, email: email.toLowerCase(), state, updated_at: new Date().toISOString() }
  // Only write a name that is actually a name: Supabase falls back to the address when a
  // provider sends no profile name, and overwriting a good name with an email is worse
  // than leaving the column alone.
  if (displayName && displayName.trim() && !displayName.includes('@')) row.display_name = displayName.trim()
  const { error } = await supabase.from('user_progress').upsert(row)
  if (!error) { unsaved = false; return }
  unsaved = true
  if (retrying) return
  retrying = true
  // Merged again rather than saved again: the row may have moved on while this device waited.
  retryWhenOnline(() => { retrying = false; if (current?.userId === userId) void startSync(userId, email, displayName) })
}

/** Whether this device holds work the account has not received yet. */
export function hasUnsavedWork(): boolean {
  return unsaved
}

export function stopSync() {
  cancelRetry?.()
  retrying = false
  if (unsubscribe) unsubscribe()
  unsubscribe = null
  if (timer) clearTimeout(timer)
  timer = null
  current = null
}
