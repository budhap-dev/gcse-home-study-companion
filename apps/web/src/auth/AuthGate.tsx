import type { ReactNode } from 'react'
import { useAuth } from './useAuth.ts'
import { SignIn } from '../routes/SignIn.tsx'

/** Wraps the app: with sign-in configured, only allowed accounts get past this. */
export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth()
  if (auth.status === 'disabled' || auth.status === 'allowed') return <>{children}</>
  if (auth.status === 'loading') return <main className="flex min-h-dvh items-center justify-center text-ink-2">Loading…</main>
  return <SignIn auth={auth} />
}
