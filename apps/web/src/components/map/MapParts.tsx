import type { LevelInfo, Subject } from '@study/shared'
import { StatusIcon } from '../StatusChip.tsx'
import { Link } from 'react-router'
import { MAP_LEVEL_LABEL, RUNGS, countLevels, isSecure, levelsSentence, type DayBar, type MapLevel, type MapSquare } from '../../progress/map.ts'
import { SubjectIcon } from '../SubjectIcon.tsx'

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
        <span key={s.topic.id} className={`map-sq anim-sq map-l${s.level} block h-[9px] w-[9px] rounded-[2px]`} style={{ '--d': popDelay(delay, i) } as React.CSSProperties} />
      ))}
    </span>
  )
}

/**
 * One subject on Home's map: its colour along the top, its squares, how many are secure, and
 * the subject's XP level with a bar towards the next one.
 */
export function SubjectMapCard({ subject, squares, index, level }: { subject: Subject; squares: MapSquare[]; index: number; level?: LevelInfo }) {
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
        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: `color-mix(in srgb, ${subject.colour} 85%, #000)` }}>
          <SubjectIcon subjectId={subject.id} width={17} height={17} />
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
          <span aria-hidden className={`map-sq map-l${level} inline-block h-3 w-3 rounded-[3px]`} />
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

const RUNG_STATUS = ['not-secure', 'developing', 'secure', 'grade-9-ready'] as const
/** The status colours as each theme adjusts them (styles.css), so navy stays visible on a dark page. */
const RUNG_COLOUR = ['var(--status-not-secure-ink)', 'var(--status-developing-ink)', 'var(--status-secure-ink)', 'var(--status-grade-9-ink)'] as const

/**
 * The mastery ladder: four rungs, filled up to where the topic stands, the current one
 * named in full ink. A topic not started stands below the first rung. Each rung also carries
 * its status shape, so the ladder reads without its colours.
 */
export function MasteryLadder({ level }: { level: MapLevel }) {
  return (
    <ol aria-label={`Mastery: ${level === 0 ? 'not started' : RUNGS[level - 1]}`} className="grid grid-cols-4">
      {RUNGS.map((label, i) => {
        const reached = i + 1 <= level
        const current = i + 1 === level
        const status = RUNG_STATUS[i]!
        return (
          <li key={label} aria-current={current ? 'step' : undefined} className="relative flex flex-col items-center gap-1.5 text-center">
            {i < 3 && <span aria-hidden className="absolute left-1/2 top-[13px] h-[3px] w-full" style={{ background: i + 1 < level ? RUNG_COLOUR[i + 1] : 'var(--color-rule)' }} />}
            <span
              aria-hidden
              className={`relative flex h-7 w-7 items-center justify-center rounded-full ${current ? 'anim-pop ring-4 ring-[color:var(--color-surface)]' : ''}`}
              style={reached ? { background: RUNG_COLOUR[i] } : { background: 'var(--color-surface)', boxShadow: `inset 0 0 0 3px ${RUNG_COLOUR[i]}` }}
            >
              {reached && <StatusIcon status={status} size={14} colour="var(--map-on-strong)" />}
            </span>
            <span className={`text-xs font-bold leading-tight ${current ? 'text-ink' : 'text-ink-3'}`}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * One topic as a square you can press, on the subject page. Its status shape is drawn inside
 * it, so the scale reads without its colours, and its accessible name says the rest.
 */
export function TopicSquare({ square: s, picked, onPick, delay }: { square: MapSquare; picked: boolean; onPick: () => void; delay: string }) {
  const status = s.level > 0 ? RUNG_STATUS[s.level - 1] : undefined
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={picked}
      aria-label={`${s.topic.title}, Year ${s.topic.year}, ${MAP_LEVEL_LABEL[s.level]}`}
      title={s.topic.title}
      className={`map-sq anim-sq map-l${s.level} map-on-l${s.level} flex h-8 w-8 items-center justify-center rounded-lg transition-transform hover:scale-110`}
      style={{ '--d': delay, ...(picked ? { outline: '3px solid var(--color-ink)', outlineOffset: '2px' } : {}) } as React.CSSProperties}
    >
      {status && <StatusIcon status={status} size={13} colour="currentColor" />}
    </button>
  )
}
