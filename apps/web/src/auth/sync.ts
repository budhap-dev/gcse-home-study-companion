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
export async function startSync(userId: string, email: string) {
  if (!supabase) return
  stopSync()
  const { data } = await supabase.from('user_progress').select('state').eq('user_id', userId).maybeSingle()
  const remote = (data?.state ?? null) as Partial<ProgressState> | null
  const merged = remote ? mergeProgress(getState(), remote) : getState()
  applyingRemote = true
  replaceState(merged)
  applyingRemote = false
  await save(userId, email, merged)
  unsubscribe = subscribe(() => {
    if (applyingRemote) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void save(userId, email, getState()), 1500)
  })
}

async function save(userId: string, email: string, state: ProgressState) {
  if (!supabase) return
  await supabase.from('user_progress').upsert({ user_id: userId, email: email.toLowerCase(), state, updated_at: new Date().toISOString() })
}

export function stopSync() {
  if (unsubscribe) unsubscribe()
  unsubscribe = null
  if (timer) clearTimeout(timer)
  timer = null
}
