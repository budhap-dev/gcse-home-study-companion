import { Link } from 'react-router'
import { ChevronIcon } from './icons.tsx'

/**
 * The way back from a screen's start page, at its top left (13 November 2026: the owner asked
 * for one on the worksheet start page, then on the timed one). Every start page uses this, so
 * the way out is always in the same place and looks the same.
 */
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="btn btn-secondary btn-sm w-fit">
      <ChevronIcon width={16} height={16} className="rotate-180" aria-hidden />
      {label}
    </Link>
  )
}
