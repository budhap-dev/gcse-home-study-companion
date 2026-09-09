import { useSyncExternalStore } from 'react'
import { AUTH_ENABLED, supabase } from './client.ts'
import { startSync, stopSync } from './sync.ts'

export type AuthStatus = 'disabled' | 'loading' | 'signed-out' | 'checking' | 'allowed' | 'denied' | 'error'

export interface AuthState {
  status: AuthStatus
  email?: string
  userId?: string
  message?: string
  /** Display name from the Google profile, or the part of the email before the @. */
  name?: string
  avatar?: string
  role?: 'parent' | 'student'
}

interface Profile { name?: string; avatar?: string }
function profileOf(user: { email?: string; user_metadata?: Record<string, unknown> }): Profile {
  const m = user.user_metadata ?? {}
  const name = (m.full_name ?? m.name ?? user.email?.split('@')[0]) as string | undefined
  return { name, avatar: typeof m.avatar_url === 'string' ? m.avatar_url : typeof m.picture === 'string' ? m.picture : undefined }
}

let state: AuthState = { status: AUTH_ENABLED ? 'loading' : 'disabled' }
const listeners = new Set<() => void>()
function set(next: AuthState) {
  state = next
  listeners.forEach((fn) => fn())
}

/** After Google sign-in, ask the database whether this account is on the family list. */
async function checkAllowed(userId: string, email: string, profile: Profile = {}) {
  if (!supabase) return
  set({ status: 'checking', email, userId, ...profile })
  const { data, error } = await supabase.rpc('is_allowed')
  if (error) {
    set({ status: 'error', email, message: error.message })
    return
  }
  if (data === true) {
    const { data: role } = await supabase.rpc('my_role')
    set({ status: 'allowed', email, userId, ...profile, role: role === 'parent' ? 'parent' : 'student' })
    startSync(userId, email)
  } else {
    await supabase.auth.signOut()
    set({ status: 'denied', email, message: `${email} is not on the family list.` })
  }
}

if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    const s = data.session
    if (s?.user.email) void checkAllowed(s.user.id, s.user.email, profileOf(s.user))
    else set({ status: 'signed-out' })
  }).catch((e: Error) => set({ status: 'error', message: e.message }))
  supabase.auth.onAuthStateChange((event, s) => {
    if (event === 'SIGNED_IN' && s?.user.email && state.status !== 'allowed' && state.status !== 'checking') void checkAllowed(s.user.id, s.user.email, profileOf(s.user))
    if (event === 'SIGNED_OUT') {
      stopSync()
      if (state.status !== 'denied') set({ status: 'signed-out' })
    }
  })
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
    () => state,
    () => state,
  )
}

export async function signInWithGoogle() {
  if (!supabase) return
  set({ status: 'loading' })
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
  if (error) set({ status: 'error', message: error.message })
}

export async function signOut() {
  if (!supabase) return
  stopSync()
  await supabase.auth.signOut()
  set({ status: 'signed-out' })
}
