import { STATUS_COLOUR, STATUS_LABEL, type TopicStatus } from '@study/shared'

/** Status by shape as well as colour, so colour is never the only carrier of meaning. */
export function StatusIcon({ status, size = 14 }: { status: TopicStatus; size?: number }) {
  const c = STATUS_COLOUR[status]
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

export function StatusChip({ status }: { status: TopicStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: STATUS_COLOUR[status] }}>
      <StatusIcon status={status} size={12} />
      {STATUS_LABEL[status]}
    </span>
  )
}
