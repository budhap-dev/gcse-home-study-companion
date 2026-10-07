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
 * Minutes a day this week, as seven columns that grow into place, against the daily goal
 * drawn across them. A day that reached the goal turns green, today is picked out, days
 * still to come are faint, and the whole chart is one image named day by day.
 */
export function WeekBars({ days, goal }: { days: DayBar[]; goal: number }) {
  const most = Math.max(30, goal * 1.25, ...days.map((d) => d.minutes))
  const px = (m: number) => Math.round((m / most) * 60)
  const label = days.filter((d) => !d.future).map((d) => `${d.name} ${d.minutes}${d.minutes >= goal ? ', goal met' : ''}`).join('; ')
  return (
    <div role="img" aria-label={`Minutes studied each day this week, against a goal of ${goal}: ${label}`} className="relative grid h-24 grid-cols-7 items-end gap-2">
      {/* The goal, behind the bars: the day letters are a fixed h-4 under a gap-1, so the
          bars stand 20px up from the bottom and the line sits the goal's height above that. */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-3" style={{ bottom: `${20 + px(goal)}px` }} />
      {days.map((d, i) => (
        <span key={d.day} className="flex h-full flex-col items-center justify-end gap-1">
          {d.minutes > 0 && <span aria-hidden className="text-[11px] font-bold tabular-nums text-ink-2">{d.minutes}</span>}
          <span
            aria-hidden
            className={`anim-grow-y relative block w-full rounded-md ${d.future ? 'bg-panel' : d.minutes >= goal ? 'bg-status-secure' : d.minutes > 0 ? '' : 'bg-rule'}`}
            style={{
              height: `${Math.max(4, px(d.minutes))}px`,
              '--d': `${(0.4 + i * 0.06).toFixed(2)}s`,
              ...(d.minutes > 0 && d.minutes < goal && !d.future ? { backgroundImage: 'linear-gradient(0deg, var(--hero-2), var(--hero-3))' } : {}),
            } as React.CSSProperties}
          />
          <span aria-hidden className={`h-4 text-xs font-bold leading-4 ${d.today ? 'text-ink' : 'text-ink-3'}`}>{d.label}</span>
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
 * The squares of one unit: a wrapped row of them on a phone, and from tablet width a grid of
 * named tiles (see TopicSquare), as many to a row as the unit's card has room for. Ten rem
 * at least, so a tile is 180 to 215px at every width and a 70-character title ("Paper 1
 * Questions 1 and 2: finding information and analysing language") fits its three lines.
 */
export const SQUARES_GRID = 'flex flex-wrap gap-1.5 md:grid md:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]'

/**
 * One topic as a square you can press, on the subject page. Its status shape is drawn inside
 * it, so the scale reads without its colours, and its accessible name says the rest. From
 * tablet width, where there is room, the square sits in a tile with its topic's name beside
 * it: a map of nameless squares had to be pressed one at a time to find out which was which.
 * The name is ink on the surface, not on the square's fill, where 12px text on a mid tint
 * measured 3.3:1 in the paper theme.
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
      className="anim-sq flex items-center rounded-lg transition-transform hover:scale-110 md:min-h-11 md:gap-2 md:rounded-xl md:border md:border-rule md:bg-surface md:px-2 md:py-1.5 md:text-left md:hover:scale-[1.03]"
      style={{ '--d': delay, ...(picked ? { outline: '3px solid var(--color-ink)', outlineOffset: '2px' } : {}) } as React.CSSProperties}
    >
      <span aria-hidden className={`map-sq map-l${s.level} map-on-l${s.level} flex h-8 w-8 shrink-0 items-center justify-center rounded-lg md:h-6 md:w-6 md:rounded-md`}>
        {status && <StatusIcon status={status} size={13} colour="currentColor" />}
      </span>
      <span className="hidden text-[12px] font-bold leading-tight md:line-clamp-3">{s.topic.title}</span>
    </button>
  )
}
