import { LogoMark } from '../components/Logo.tsx'
import { Smiley } from '../components/Smiley.tsx'
import { signInWithGoogle, type AuthState } from '../auth/useAuth.ts'

/** Shown before the app when family sign-in is configured. */
export function SignIn({ auth }: { auth: AuthState }) {
  const busy = auth.status === 'loading' || auth.status === 'checking'
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <LogoMark size={72} />
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold">Home Study Companion</h1>
        <p className="text-ink-2">Lessons, quizzes and worksheets for GCSE, one topic at a time.</p>
      </div>
      <button type="button" onClick={() => void signInWithGoogle()} disabled={busy} className="press flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-rule bg-surface font-bold disabled:opacity-60">
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/><path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.9l-7.8 6C6.5 42.6 14.6 48 24 48z"/></svg>
        {busy ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {auth.status === 'denied' && (
        <p className="rounded-xl border border-status-not-secure px-4 py-3 text-sm" style={{ background: 'color-mix(in srgb, var(--color-status-not-secure) 12%, var(--color-surface))' }} role="alert">
          <Smiley>🙈</Smiley> {auth.message} Ask whoever set the app up to add it, then try again.
        </p>
      )}
      {auth.status === 'error' && (
        <p className="rounded-xl border border-status-developing px-4 py-3 text-sm" style={{ background: 'color-mix(in srgb, var(--color-status-developing) 12%, var(--color-surface))' }} role="alert">Sign-in did not work: {auth.message}</p>
      )}
      <p className="text-xs text-ink-3">This app is for our family. Only listed Google accounts can sign in, and progress is saved to your account.</p>
    </main>
  )
}
