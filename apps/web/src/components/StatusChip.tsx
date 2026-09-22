import { STATUS_COLOUR, STATUS_LABEL, type TopicStatus } from '@study/shared'

/** Status by shape as well as colour, so colour is never the only carrier of meaning. */
export function StatusIcon({ status, size = 14, colour }: { status: TopicStatus; size?: number; colour?: string }) {
  const c = colour ?? STATUS_COLOUR[status]
  switch (status) {
    case 'not-secure':
      return <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden><circle cx="7" cy="7" r="5" fill="none" stroke={c} strokeWidth="2" /></svg>
    case 'developing':
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden>
          <circle cx="7" cy="7" r="5" fill="none" stroke={c} strokeWidth="2" />
          <path d="M7 2a5 5 0 0 1 0 10z" fill={c} />
        </svg>
      )
    case 'secure':
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden>
          <circle cx="7" cy="7" r="6" fill={c} />
          <path d="M4 7l2 2 4-4" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'grade-9-ready':
      return <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden><path d="M7 1l1.8 3.9 4.2.5-3.1 2.9.8 4.2L7 10.4l-3.7 2.1.8-4.2L1 5.4l4.2-.5z" fill={c} /></svg>
  }
}

/**
 * The themed form of each status colour.
 *
 * STATUS_COLOUR holds the palette as authored, which is what the donut and the progress
 * bars paint. As *text* those same colours were down at 2.98:1 ("Secure") and 3.26:1
 * ("Not secure"), so the chip reads them through the tokens styles.css clamps per theme.
 */
const STATUS_INK: Record<TopicStatus, string> = {
  'not-secure': 'var(--status-not-secure-ink)',
  developing: 'var(--status-developing-ink)',
  secure: 'var(--status-secure-ink)',
  'grade-9-ready': 'var(--status-grade-9-ink)',
}

export function StatusChip({ status }: { status: TopicStatus }) {
  return (
    // currentColor on the icon, so the shape stays the same colour as its label.
    <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: STATUS_INK[status] }}>
      <StatusIcon status={status} size={12} colour="currentColor" />
      {STATUS_LABEL[status]}
    </span>
  )
}
