import type { LevelInfo, Subject } from '@study/shared'
import { Link } from 'react-router'
import { MAP_LEVEL_LABEL, countLevels, isSecure, levelsSentence, type DayBar, type MapSquare } from '../../progress/map.ts'

/**
 * The map's small pieces (Option C), shared by Home and the subject page. Squares are
 * painted by the .map-l* classes in styles.css, which shade the subject's own colour on one
 * ordinal scale; the colour comes from --subject, so a square takes whatever subject it sits in.
 */

/** Delay for the n-th square to pop in: a quick ripple, capped so a long map is not kept waiting. */
const popDelay = (base: number, i: number) => `${(base + Math.min(i, 120) * 0.006).toFixed(3)}s`

/**
 * A subject's squares at a glance, too small to press one at a time: the whole card is the
 * link. The list is one image to a screen reader, named by its counts.
 */
export function MiniMap({ squares, name, delay = 0 }: { squares: MapSquare[]; name: string; delay?: number }) {
  return (
    <span role="img" aria-label={`${name}: ${levelsSentence(countLevels(squares))}`} className="flex flex-wrap content-start gap-[3px]">
      {squares.map((s, i) => (
        <span key={s.topic.id} className={`map-sq anim-sq map-l${s.level} h-[9px] w-[9px] rounded-[2px]`} style={{ '--d': popDelay(delay, i) } as React.CSSProperties} />
      ))}
    </span>
  )
}

/**
 * One subject on Home's map: its colour along the top, its squares, how many are secure, and
 * the subject's XP level with a bar towards the next one.
 */
export function SubjectMapCard({ subject, squares, index, level, note }: { subject: Subject; squares: MapSquare[]; index: number; level?: LevelInfo; note?: string }) {
  const secure = squares.filter(isSecure).length
  const delay = 0.15 + index * 0.05
  return (
    <Link
      to={`/subjects/${subject.id}`}
      style={{ '--subject': subject.colour, '--d': `${delay.toFixed(2)}s` } as React.CSSProperties}
      className="anim-rise lift card-top flex flex-col gap-2.5 rounded-2xl border border-rule bg-surface px-3.5 pb-3 pt-2.5 shadow-[0_1px_2px_rgb(16_24_40/0.05),0_8px_24px_rgb(16_24_40/0.04)]"
    >
      <span className="flex items-center gap-2">
        {/* White on the subject colour with a little black in it: Business's own ochre
            measured 4.25:1 under white, and 15% black lifts every subject past 5:1. */}
        <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: `color-mix(in srgb, ${subject.colour} 85%, #000)` }}>
          {subject.name[0]}
        </span>
        <span className="min-w-0 text-[15px] font-bold leading-tight">{subject.name}</span>
      </span>
      <MiniMap squares={squares} name={subject.name} delay={delay + 0.1} />
      <span className="mt-auto flex flex-col gap-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-2 text-[13px] text-ink-2">
          <span><strong className="accent-ink">{secure}</strong> of {squares.length} secure</span>
          <span className="text-xs font-bold accent-ink">{level ? level.name : 'Level 1'}</span>
        </span>
        <span className="block h-1 overflow-hidden rounded-full bg-panel" aria-hidden>
          <span className="anim-grow-x block h-full rounded-full" style={{ width: `${Math.round((level?.progress ?? 0) * 100)}%`, background: subject.colour, '--d': `${(delay + 0.3).toFixed(2)}s` } as React.CSSProperties} />
        </span>
        {note && <span className="text-xs text-ink-2">{note}</span>}
      </span>
    </Link>
  )
}

/** The key to the squares: not started, then the four statuses from lightest to darkest. */
export function MapLegend({ className = '' }: { className?: string }) {
  return (
    <span className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2 ${className}`} style={{ '--subject': 'var(--hero-2)' } as React.CSSProperties}>
      {MAP_LEVEL_LABEL.map((label, level) => (
        <span key={label} className="flex items-center gap-1.5">
          <span aria-hidden className={`map-sq map-l${level} h-3 w-3`} />
          {label}
        </span>
      ))}
    </span>
  )
}

/**
 * Minutes a day this week, as seven columns that grow into place. Today is picked out, days
 * still to come are faint, and the whole chart is one image named day by day.
 */
export function WeekBars({ days }: { days: DayBar[] }) {
  const most = Math.max(30, ...days.map((d) => d.minutes))
  const label = days.filter((d) => !d.future).map((d) => `${d.name} ${d.minutes}`).join(', ')
  return (
    <div role="img" aria-label={`Minutes studied each day this week: ${label}`} className="grid h-24 grid-cols-7 items-end gap-2">
      {days.map((d, i) => (
        <span key={d.day} className="flex h-full flex-col items-center justify-end gap-1">
          {d.minutes > 0 && <span aria-hidden className="text-[11px] font-bold tabular-nums text-ink-2">{d.minutes}</span>}
          <span
            aria-hidden
            className={`anim-grow-y block w-full rounded-md ${d.future ? 'bg-panel' : d.minutes > 0 ? '' : 'bg-rule'}`}
            style={{
              height: `${Math.max(4, Math.round((d.minutes / most) * 60))}px`,
              '--d': `${(0.4 + i * 0.06).toFixed(2)}s`,
              ...(d.minutes > 0 && !d.future ? { backgroundImage: 'linear-gradient(0deg, var(--hero-2), var(--hero-3))' } : {}),
            } as React.CSSProperties}
          />
          <span aria-hidden className={`text-xs font-bold ${d.today ? 'text-ink' : 'text-ink-3'}`}>{d.label}</span>
        </span>
      ))}
    </div>
  )
}
