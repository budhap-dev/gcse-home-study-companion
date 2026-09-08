import { usePref } from '../theme/prefs.ts'

/** An emoji that disappears when smileys are switched off. Decorative, so hidden from screen readers. */
export function Smiley({ children, className = '', bounce = false }: { children: string; className?: string; bounce?: boolean }) {
  const on = usePref('smileys')
  if (!on) return null
  return <span aria-hidden className={`inline-block ${bounce ? 'anim-bounce' : ''} ${className}`}>{children}</span>
}
