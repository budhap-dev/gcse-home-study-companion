/** Rosette badge, filled when earned and outlined when not. */
export function BadgeIcon({ earned, size = 36 }: { earned: boolean; size?: number }) {
  const c = earned ? 'var(--subject, #1e2330)' : '#c9c5bb'
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <path d="M20 3l3.5 3.2 4.7-.8 1.6 4.5 4.3 2.1-.9 4.7 2.9 3.8-3.6 3.1.2 4.8-4.7 1.2-2.3 4.2-4.5-1.6L20 37l-3.2-3.1-4.5 1.6-2.3-4.2-4.7-1.2.2-4.8L2 21.5l2.9-3.8-.9-4.7 4.3-2.1 1.6-4.5 4.7.8z" fill={earned ? c : '#fff'} stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <path d="M13 20.5l4.5 4.5L27 15" fill="none" stroke={earned ? '#fff' : c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
