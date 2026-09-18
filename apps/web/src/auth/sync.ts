import { supabase } from './client.ts'
import { getState, replaceState, subscribe, type ProgressState } from '../progress/store.ts'
import { mergeProgress } from '../progress/merge.ts'

let unsubscribe: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let applyingRemote = false

/**
 * Keeps this account's progress row in step with the device. On start, the row and
 * the device state are merged (nothing is lost either way) and both are updated;
 * after that every local change is saved a moment later.
 */
export async function startSync(userId: string, email: string, displayName?: string) {
  if (!supabase) return
  stopSync()
  const { data } = await supabase.from('user_progress').select('state').eq('user_id', userId).maybeSingle()
  const remote = (data?.state ?? null) as Partial<ProgressState> | null
  const merged = remote ? mergeProgress(getState(), remote) : getState()
  applyingRemote = true
  replaceState(merged)
  applyingRemote = false
  await save(userId, email, merged, displayName)
  unsubscribe = subscribe(() => {
    if (applyingRemote) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void save(userId, email, getState(), displayName), 1500)
  })
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
  await supabase.from('user_progress').upsert(row)
}

export function stopSync() {
  if (unsubscribe) unsubscribe()
  unsubscribe = null
  if (timer) clearTimeout(timer)
  timer = null
}
