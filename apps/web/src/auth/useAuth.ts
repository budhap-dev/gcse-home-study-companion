import { useSyncExternalStore } from 'react'
import { AUTH_ENABLED, supabase } from './client.ts'
import { startSync, stopSync } from './sync.ts'
import { setErrorReportingSignedIn } from './reports.ts'

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
  /** Opened on the remembered allow-list answer, with no signal to check it (UXI-5). */
  offline?: boolean
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
  // Error reports are written as the signed-in family member's device, so only then.
  setErrorReportingSignedIn(next.status === 'allowed')
  listeners.forEach((fn) => fn())
}

const REMEMBERED = 'study-companion.allowed'

/**
 * The last allow-list answer this device was given, kept so the app opens with no signal
 * (UXI-5). Without it, a student on a train met the sign-in page, because asking the database
 * whether the account is allowed is itself a request. It holds nothing secret: the database's
 * own rules still decide what the account can read once there is a connection, and the
 * question is asked again as soon as there is one.
 */
interface Remembered { userId: string; email: string; role: 'parent' | 'student'; name?: string; avatar?: string }

function remember(r: Remembered | null) {
  try {
    if (r) localStorage.setItem(REMEMBERED, JSON.stringify(r))
    else localStorage.removeItem(REMEMBERED)
  } catch {
    // Storage blocked: the app needs a signal to open, as it did before.
  }
}

export function remembered(): Remembered | null {
  try {
    const raw = localStorage.getItem(REMEMBERED)
    return raw ? (JSON.parse(raw) as Remembered) : null
  } catch {
    return null
  }
}

/** A failure that says nothing about the account: no signal, or the server out of reach. */
export function isNetworkFailure(message: string | undefined, online = navigator.onLine): boolean {
  return online === false || /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message ?? '')
}

/**
 * Opens the app on the remembered answer when there is no signal, and asks again when the
 * signal returns. Returns false when there is nothing remembered for this account (or for any
 * account, when `userId` is not known), so the caller shows what it would have shown.
 */
function openOffline(userId?: string): boolean {
  const r = remembered()
  if (!r || (userId && r.userId !== userId)) return false
  set({ status: 'allowed', email: r.email, userId: r.userId, name: r.name, avatar: r.avatar, role: r.role, offline: true })
  window.addEventListener('online', () => void recheck(), { once: true })
  return true
}

/** With the signal back, the session is read again and the account checked again, out of sight. */
async function recheck() {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  const s = data.session
  if (s?.user.email) void checkAllowed(s.user.id, s.user.email, profileOf(s.user), true)
}

/**
 * After Google sign-in, ask the database whether this account is on the family list. `quiet`
 * leaves the app on screen while asking, for the check made when a signal returns.
 */
async function checkAllowed(userId: string, email: string, profile: Profile = {}, quiet = false) {
  if (!supabase) return
  if (!quiet) set({ status: 'checking', email, userId, ...profile })
  const { data, error } = await supabase.rpc('is_allowed')
  if (error) {
    if (isNetworkFailure(error.message) && openOffline(userId)) return
    set({ status: 'error', email, message: error.message })
    return
  }
  if (data === true) {
    const { data: role } = await supabase.rpc('my_role')
    const r: Remembered = { userId, email, role: role === 'parent' ? 'parent' : 'student', ...profile }
    remember(r)
    set({ status: 'allowed', ...r })
    startSync(userId, email, profile.name)
  } else {
    remember(null)
    await supabase.auth.signOut()
    set({ status: 'denied', email, message: `${email} is not on the family list.` })
  }
}

if (supabase) {
  supabase.auth.getSession().then(({ data, error }) => {
    const s = data.session
    if (s?.user.email) void checkAllowed(s.user.id, s.user.email, profileOf(s.user))
    // An expired session cannot be renewed without a signal, so it reads as no session at all.
    else if (error && isNetworkFailure(error.message) && openOffline()) return
    else if (!navigator.onLine && openOffline()) return
    else set({ status: 'signed-out' })
  }).catch((e: Error) => {
    if (isNetworkFailure(e.message) && openOffline()) return
    set({ status: 'error', message: e.message })
  })
  supabase.auth.onAuthStateChange((event, s) => {
    if (event === 'SIGNED_IN' && s?.user.email && state.status !== 'allowed' && state.status !== 'checking') void checkAllowed(s.user.id, s.user.email, profileOf(s.user))
    if (event === 'SIGNED_OUT') {
      stopSync()
      // Offline, a session that could not be renewed signs out on its own: keep the app open
      // on the remembered answer. Only signing out on purpose (below) forgets it.
      if (state.status === 'allowed' && state.offline) return
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
  remember(null)
  await supabase.auth.signOut()
  set({ status: 'signed-out' })
}
