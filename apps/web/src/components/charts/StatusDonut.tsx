import { STATUS_COLOUR, STATUS_LABEL, TOPIC_STATUSES } from '@study/shared'
import { donutSlices, type StatusTotals } from '../../progress/charts.ts'

const SIZE = 168
const R = 66
const STROKE = 26

/** A point on the ring, with 0 at the top and going clockwise. */
const at = (turn: number) => {
  const a = (turn - 0.25) * 2 * Math.PI
  return [SIZE / 2 + R * Math.cos(a), SIZE / 2 + R * Math.sin(a)] as const
}

/**
 * Topic statuses as a ring, with the headline figure in the hole.
 *
 * A donut rather than a pie because the middle is the most valuable space on the chart:
 * the number a parent actually wants is "how many are secure", and putting it inside
 * means they do not have to read the ring at all unless they want the breakdown.
 *
 * The ring shows the topics that have been **started**, not every topic in the pack.
 * Eight subjects hold hundreds of topics and a student meets them over three years, so
 * including the untouched ones drew a ring that was ninety-eight per cent grey and said
 * nothing. How many are left is a number, printed underneath, not a slice.
 */
export function StatusDonut({ totals }: { totals: StatusTotals }) {
  const secure = totals.counts.secure + totals.counts['grade-9-ready']
  const slices = donutSlices(
    TOPIC_STATUSES.map((s) => ({ key: s, label: STATUS_LABEL[s], value: totals.counts[s], colour: STATUS_COLOUR[s] })).reverse(),
  )
  const alt = `${secure} of the ${totals.started} topics started are secure or better; ${totals.notStarted} not started yet`

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-label={alt} className="shrink-0">
        {/* An empty ring still needs drawing, or a fresh account shows a blank square. */}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--color-panel)" strokeWidth={STROKE} />
        {slices.map(({ slice, from, to }) => {
          // A slice covering the whole ring cannot be drawn as one arc, because its start
          // and end land on the same point and the path collapses to nothing.
          if (to - from >= 0.999) {
            return <circle key={slice.key} cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={slice.colour} strokeWidth={STROKE} />
          }
          const [x1, y1] = at(from)
          const [x2, y2] = at(to)
          return (
            <path key={slice.key} d={`M${x1} ${y1} A${R} ${R} 0 ${to - from > 0.5 ? 1 : 0} 1 ${x2} ${y2}`}
              fill="none" stroke={slice.colour} strokeWidth={STROKE} />
          )
        })}
        <text x={SIZE / 2} y={SIZE / 2 - 2} textAnchor="middle" className="fill-ink" fontSize="30" fontWeight="700">{secure}</text>
        <text x={SIZE / 2} y={SIZE / 2 + 18} textAnchor="middle" className="fill-ink-2" fontSize="12">secure</text>
      </svg>
      <ul className="flex min-w-40 flex-1 flex-col gap-1 text-sm">
        {TOPIC_STATUSES.map((s) => (
          <li key={s} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: STATUS_COLOUR[s] }} aria-hidden />
              {STATUS_LABEL[s]}
            </span>
            <strong className="tabular-nums">{totals.counts[s]}</strong>
          </li>
        ))}
        <li className="mt-1 border-t border-rule pt-1 text-xs text-ink-2">
          {totals.started} of {totals.total} topics started · {totals.notStarted} still to come
        </li>
      </ul>
    </div>
  )
}
