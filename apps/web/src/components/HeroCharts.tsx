import type { LevelInfo } from '@study/shared'
import { Link } from 'react-router'
import { MAP_LEVEL_LABEL } from '../progress/map.ts'
import { SubjectIcon } from './SubjectIcon.tsx'

/*
 * Three small charts at the foot of the Home banner on a laptop: study time over two
 * weeks, where the topics stand, and the subject nearest its next level. They sit on the
 * banner's gradient, so everything is white on a darkening glass, which only adds contrast
 * to the white text the banner already holds.
 */

const W = 280
const H = 64

/** White from faint to solid, for Not secure to Mastered; the map's own shading, lit up. */
const SHADE = ['bg-white/15', 'bg-white/35', 'bg-white/55', 'bg-white/80', 'bg-white']

export function HeroCharts({ days, goal, levels, levelUp }: {
  days: { day: string; minutes: number }[]
  goal: number
  /** Topics at each map level, not started first. */
  levels: [number, number, number, number, number]
  levelUp?: { subjectId: string; name: string; level: LevelInfo }
}) {
  return (
    <div className="anim-rise relative hidden gap-3 pt-2 lg:grid lg:grid-cols-2 xl:grid-cols-3" style={{ '--d': '0.2s' } as React.CSSProperties}>
      <StudyTime days={days} goal={goal} />
      <TopicMix levels={levels} />
      {levelUp && <NextLevel {...levelUp} />}
    </div>
  )
}

const glass = 'flex min-w-0 flex-col gap-2 rounded-2xl bg-[rgb(0_0_0/0.16)] p-4 ring-1 ring-inset ring-white/15'

function Head({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.1em]">{label}</span>
      <span className="whitespace-nowrap text-sm font-bold tabular-nums">{value}</span>
    </span>
  )
}

const short = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/** Minutes a day as a soft area, with the pace the weekly goal asks for drawn across it. */
function StudyTime({ days, goal }: { days: { day: string; minutes: number }[]; goal: number }) {
  const pace = goal / 7
  const most = Math.max(30, pace * 1.25, ...days.map((d) => d.minutes))
  const x = (i: number) => (i * W) / (days.length - 1)
  const y = (m: number) => H - 4 - (m / most) * (H - 10)
  // Each step bends through the midpoint between days, so the curve never overshoots a day's value.
  const line = days.map((d, i) => (i === 0 ? `M0 ${y(d.minutes)}` : `C${(x(i - 1) + x(i)) / 2} ${y(days[i - 1]!.minutes)} ${(x(i - 1) + x(i)) / 2} ${y(d.minutes)} ${x(i)} ${y(d.minutes)}`)).join(' ')
  const total = days.reduce((n, d) => n + d.minutes, 0)
  const top = days.reduce((a, d) => (d.minutes > a.minutes ? d : a), days[0]!)
  const today = days.at(-1)!
  return (
    <div className={glass}>
      <Head label={`Last ${days.length} days`} value={`${total} min`} />
      <div className="relative" role="img" aria-label={total === 0 ? `No study time in the last ${days.length} days yet` : `Study time over the last ${days.length} days: ${total} minutes in all, the most on ${short(top.day)} with ${top.minutes}. Today ${today.minutes}.`}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-16 w-full overflow-visible" aria-hidden>
          <defs>
            <linearGradient id="hero-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" x2={W} y1={y(pace)} y2={y(pace)} stroke="#fff" strokeOpacity="0.55" strokeDasharray="4 4" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
          <path d={`${line} L${W} ${H} L0 ${H}Z`} fill="url(#hero-area)" />
          <path d={line} fill="none" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span aria-hidden className="absolute right-0 h-2.5 w-2.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-white shadow-[0_0_0_4px_rgb(255_255_255/0.25)]" style={{ top: `${(100 * y(today.minutes)) / H}%` }} />
      </div>
      <span className="flex justify-between text-[11px]" aria-hidden>
        <span>{short(days[0]!.day)}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 border-t-[1.5px] border-dashed border-white/70" />goal pace</span>
        <span>Today</span>
      </span>
    </div>
  )
}

/** Every topic of the student's subjects in one bar, brightest where best known. */
function TopicMix({ levels }: { levels: [number, number, number, number, number] }) {
  const total = levels.reduce((a, b) => a + b, 0)
  const started = total - levels[0]
  const order = [4, 3, 2, 1, 0]
  return (
    <div className={glass}>
      <Head label="Your topics" value={`${started} of ${total} started`} />
      <span className="flex h-3.5 overflow-hidden rounded-full bg-white/10" role="img" aria-label={order.map((l) => `${MAP_LEVEL_LABEL[l]} ${levels[l]}`).join(', ')}>
        {/* Shares of the whole, but never thinner than a sliver, so the first few topics show against hundreds. */}
        {order.map((l) => levels[l] > 0 && <span key={l} className={`${SHADE[l]} h-full min-w-2 basis-0 border-r border-[rgb(0_0_0/0.12)] last:border-r-0`} style={{ flexGrow: levels[l] }} />)}
      </span>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]" aria-hidden>
        {order.map((l) => (
          <li key={l} className={`flex items-center gap-1.5 ${l === 0 ? 'col-span-2' : ''}`}>
            <span className={`${SHADE[l]} inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]`} />
            <span className="truncate">{MAP_LEVEL_LABEL[l]}</span>
            <span className={`font-bold tabular-nums ${l === 0 ? '' : 'ml-auto'}`}>{levels[l]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The subject closest to levelling up, as a ring round its icon. */
function NextLevel({ subjectId, name, level }: { subjectId: string; name: string; level: LevelInfo }) {
  const r = 24
  const c = 2 * Math.PI * r
  const left = level.span - level.into
  return (
    <Link to={`/subjects/${subjectId}`} className={`${glass} lift lg:max-xl:hidden`}>
      <Head label="Next level" value={`${Math.round(level.progress * 100)}%`} />
      <span className="flex flex-1 items-center gap-3">
        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
          <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="28" cy="28" r={r} fill="none" stroke="#fff" strokeOpacity="0.2" strokeWidth="5" />
            <circle cx="28" cy="28" r={r} fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - level.progress)} />
          </svg>
          <SubjectIcon subjectId={subjectId} width={22} height={22} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-bold">{name}</span>
          <span className="text-[12px]">{left} XP to <strong>{level.nextName}</strong></span>
        </span>
      </span>
    </Link>
  )
}
