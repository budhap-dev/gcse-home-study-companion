import { BADGES, SUBJECTS, factOfTheDay, type SubjectId } from '@study/shared'
import { SectionLabel } from '../../components/KindChip.tsx'
import { SetForYou } from '../../components/AssignedTasks.tsx'
import { useAuth } from '../../auth/useAuth.ts'
import { useState } from 'react'
import { levelBySubject, totalXp } from '../../progress/xp.ts'
import { Smiley } from '../../components/Smiley.tsx'
import { Link } from 'react-router'
import { TOPICS, topicsForSubject } from '../../content/index.ts'
import { recommend, type Task } from '../../progress/recommend.ts'
import { isoDate, setProfile, streakDays, studiedTopics, weekMinutes } from '../../progress/store.ts'
import { daysThisWeek, fixFirst, isSecure, square } from '../../progress/map.ts'
import { MapLegend, SubjectMapCard, WeekBars } from '../../components/map/MapParts.tsx'
import { ProfileForm, daysUntil } from '../../components/ProfileForm.tsx'
import { useProgress } from '../../progress/useProgress.ts'
import { mistakeQueue } from '../../progress/mistakes.ts'
import { redoable } from './Mistakes.tsx'
import { doneToday, todayPlan, type PlanItem } from '../../progress/today.ts'
import { assignedTasks } from '../../progress/assignments.ts'
import { useMyAssignments } from '../../auth/assignments.ts'

/**
 * Home as the map (Option C). A banner with the day's numbers and the first thing to do,
 * today's plan beside it, then every topic of every subject as a square, shaded by how well
 * it is known, so the gaps show at a glance. The weakest started topics, the fact of the day
 * and the week's minutes come after.
 */
export function Home() {
  const progress = useProgress()
  const profile = progress.profile ?? {}
  // The plan covers the subjects the student takes (UXI-10); all of them until they say.
  const studied = studiedTopics(TOPICS, profile)
  const { next, alternatives } = recommend(studied, progress)
  const mistakes = mistakeQueue(progress, redoable)
  const { list: assignments } = useMyAssignments()
  const plan = todayPlan(studied, progress, assignedTasks(assignments, progress), mistakes.length)
  const done = doneToday(TOPICS, progress)
  const others = alternatives.filter((t) => !plan.some((p) => p.to === t.to))
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const levels = levelBySubject(progress)
  const auth = useAuth()
  const firstName = auth.status === 'allowed' && auth.name ? auth.name.split(' ')[0] : undefined
  const [factOffset, setFactOffset] = useState(0)
  const fact = factOfTheDay(SUBJECTS.filter((s) => topicsForSubject(s.id).length > 0).map((s) => s.id), new Date(), factOffset)

  // The map: every topic of every subject the student takes, one square each.
  const mapped = SUBJECTS.filter((s) => topicsForSubject(s.id).length > 0 && (!profile.subjects?.length || profile.subjects.includes(s.id)))
    .map((s) => ({ subject: s, squares: topicsForSubject(s.id).map((t) => square(t, progress)) }))
  // Anything already in today's plan is not offered twice.
  const fix = fixFirst(studied, progress, new Date(), 6).filter((f) => !plan.some((p) => p.to === f.to)).slice(0, 3)

  const fresh = !profile.setupAt && progress.attempts.length === 0 && Object.keys(progress.lessons).length === 0
  if (fresh) return <Welcome />

  return (
    <article className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-x-8">
      <Hero
        greeting={`${greeting}${firstName ? `, ${firstName}` : ''}`}
        welcome={firstName ? `Welcome back. Your progress is saved to your account${auth.role === 'parent' ? ', and you can manage the family in Settings' : ''}.` : undefined}
        streak={streakDays(progress)}
        minutes={weekMinutes(progress)}
        goal={progress.goalMinutes}
        offToday={progress.daysOff.includes(isoDate())}
        secure={mapped.reduce((n, m) => n + m.squares.filter(isSecure).length, 0)}
        xp={totalXp(progress)}
        badges={`${Object.keys(progress.badges).length} of ${BADGES.length}`}
        first={plan[0]}
        mistakes={mistakes.length}
        tiles={mapped.slice(0, 6).map((m) => m.subject.colour)}
      />

      <div className="flex flex-col gap-5">
        {plan.length > 0 ? (
          <section className="anim-rise flex flex-col gap-2" style={{ '--d': '0.08s' } as React.CSSProperties}>
            <SectionLabel colour="#c8501f" emoji="🚀">Today</SectionLabel>
            {plan.map((item, i) => <PlanCard key={item.to} item={item} primary={i === 0} />)}
            {done.length > 0 && (
              <p className="text-sm text-ink-2">
                <strong className="text-ink">Done today:</strong> {done.map((d) => `${d.what} · ${d.topicTitle}${d.detail ? ` (${d.detail})` : ''}`).join('; ')}.
              </p>
            )}
          </section>
        ) : !next && (
          <p className="text-ink-2">No topics yet. They appear here as they are written.</p>
        )}
        {/* Every task a parent set, done or not, below the plan that picks the most pressing one. */}
        <SetForYou />
      </div>

      {!profile.setupAt && (
        <Link to="/settings#you" className="lift flex items-center gap-3 rounded-2xl border border-dashed border-rule bg-surface px-4 py-3 lg:col-span-2">
          <span className="flex flex-grow flex-col gap-0.5">
            <span className="font-bold">Tell the app your year and subjects</span>
            <span className="text-xs text-ink-2">So the plan and your map cover what you take. Half a minute.</span>
          </span>
          <span className="rounded-lg border border-rule px-3 py-1.5 text-sm font-bold">Set up</span>
        </Link>
      )}

      <section className="flex flex-col gap-3 lg:col-span-2" aria-labelledby="map-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="map-heading" className="text-[22px] font-bold leading-tight">
            Your map <span className="font-sans text-[15px] font-normal text-ink-2">· every topic, every subject</span>
          </h2>
          <MapLegend />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {mapped.map((m, i) => (
            <SubjectMapCard key={m.subject.id} subject={m.subject} squares={m.squares} index={i} level={levels[m.subject.id as SubjectId]} note={examNote(profile.examDates?.[m.subject.id])} />
          ))}
          {!profile.subjects?.length && (
            <Link to="/settings#you" className="anim-rise lift flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-rule p-3 text-center text-sm font-bold text-ink-2" style={{ '--d': `${(0.15 + mapped.length * 0.05).toFixed(2)}s` } as React.CSSProperties}>
              <span aria-hidden className="text-2xl leading-none">+</span>
              Choose which subjects you take
            </Link>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-5">
        {fix.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionLabel colour="#d25b3b" emoji="🩹">Fix these first</SectionLabel>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
              {fix.map((f, i) => (
                <Link key={f.topic.id} to={f.to} className="anim-rise lift flex items-center gap-3 rounded-2xl border border-rule bg-surface px-3.5 py-3" style={{ '--subject': f.subjectColour, '--d': `${(0.3 + i * 0.06).toFixed(2)}s` } as React.CSSProperties}>
                  <span aria-hidden className="tint flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"><Smiley>🎯</Smiley></span>
                  <span className="flex min-w-0 flex-grow flex-col gap-0.5">
                    <span className="font-bold leading-snug">{f.topic.title}</span>
                    <span className="text-xs text-ink-2">{f.subjectName} · {f.note} · about {f.minutes} min</span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-[color:var(--subject)] px-3 py-1.5 text-sm font-bold text-white">Quiz</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionLabel colour="#1f3a93" emoji="🧭">Or choose</SectionLabel>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {others.map((t) => <TaskCard key={t.to} task={t} />)}
            </div>
          </section>
        )}
      </div>

      <aside className="flex flex-col gap-5">
        {fact && (
          <section
            key={factOffset}
            className="anim-fade-up relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-5"
            style={{ '--subject': SUBJECTS.find((s) => s.id === fact.subjectId)?.colour, borderColor: 'color-mix(in srgb, var(--subject) 45%, transparent)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--subject) 18%, var(--color-surface)), var(--color-surface) 70%)' } as React.CSSProperties}
          >
            <span className="pointer-events-none absolute -right-4 -top-6 text-[7rem] opacity-15" aria-hidden><Smiley>💡</Smiley></span>
            <div className="flex items-center gap-2">
              <span className="chip" style={{ '--chip': 'var(--subject)' } as React.CSSProperties}><Smiley>💡</Smiley>Did you know</span>
              <span className="text-xs font-bold accent-ink">{SUBJECTS.find((s) => s.id === fact.subjectId)?.name}</span>
            </div>
            <p className="relative text-[15px] leading-relaxed">{fact.text}</p>
            <button type="button" onClick={() => setFactOffset((n) => n + 1)} className="press relative w-fit rounded-full bg-[color:var(--subject)] px-4 py-1.5 text-sm font-bold text-white">
              Another one <span aria-hidden>→</span>
            </button>
          </section>
        )}

        <section className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-sans text-sm font-bold text-ink-2">This week, minutes a day</h2>
            <Link to="/settings" className="-my-2 inline-block py-2 text-xs text-ink-2 underline">Change goal</Link>
          </div>
          <WeekBars days={daysThisWeek(progress)} />
        </section>
      </aside>
    </article>
  )
}

/**
 * The banner at the top of Home: the day, a greeting, four numbers the student cares about,
 * and the first thing to do. Tiles in the subjects' own colours drift beside the words on
 * wide screens, where there is room for them.
 */
function Hero({ greeting, welcome, streak, minutes, goal, offToday, secure, xp, badges, first, mistakes, tiles }: {
  greeting: string; welcome?: string; streak: number; minutes: number; goal: number; offToday: boolean
  secure: number; xp: number; badges: string; first?: PlanItem; mistakes: number; tiles: string[]
}) {
  const hour = new Date().getHours()
  const stats: [string, React.ReactNode][] = [
    [streak === 1 ? 'day streak' : 'days streak', <><span className={streak > 0 ? 'anim-flicker inline-block' : 'inline-block'}><Smiley>🔥</Smiley></span>{streak}</>],
    [offToday ? 'minutes · today is a day off' : 'minutes this week', <>{minutes}<span className="text-base font-normal"> / {goal}</span></>],
    ['topics secure', secure],
    [`XP · ${badges} badges`, xp.toLocaleString('en-GB')],
  ]
  return (
    <section className="hero-gradient anim-rise relative flex flex-col gap-4 overflow-hidden rounded-[26px] p-5 shadow-[0_16px_40px_rgb(90_75_209/0.28)] sm:p-7">
      <span className="hero-shine" aria-hidden />
      {tiles.length > 0 && (
        <span aria-hidden className="pointer-events-none absolute right-7 top-1/2 hidden -translate-y-1/2 grid-cols-2 gap-3 xl:grid">
          {tiles.map((c, i) => (
            <span key={i} className="anim-drift flex h-[52px] w-[52px] items-center justify-center rounded-[15px] bg-white/95 shadow-[0_10px_24px_rgb(0_0_0/0.2)]" style={{ '--r': `${[-6, 5, -3, 4, -5, 6][i]}deg`, '--d': `${-i * 0.7}s` } as React.CSSProperties}>
              <span className="h-5 w-5 rounded-md" style={{ background: c }} />
            </span>
          ))}
        </span>
      )}
      <div className="relative flex flex-col gap-1 xl:pr-36">
        <p className="text-xs font-bold uppercase tracking-[0.12em]">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="flex flex-wrap items-center gap-2 text-[32px] font-bold leading-[1.05] sm:text-[42px]">
          {greeting}<Smiley bounce>{hour < 12 ? '🌞' : hour < 18 ? '👋' : '🌙'}</Smiley>
        </h1>
        {welcome && <p className="text-sm">{welcome}</p>}
      </div>
      <dl className="relative grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-9 xl:pr-36">
        {stats.map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse">
            <dt className="text-[13px]">{label}</dt>
            <dd className="flex items-center gap-1 font-display text-[28px] font-bold leading-tight tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="relative flex flex-wrap gap-3">
        {first && (
          <Link to={first.to} className="lift flex min-h-12 max-w-full items-center gap-2 rounded-2xl bg-white px-5 py-2 font-bold text-[#2a2f9e] shadow-[0_8px_20px_rgb(0_0_0/0.2)]">
            <span className="truncate">{first.title}{first.topicTitle ? `: ${first.topicTitle}` : ''}</span>
            <span aria-hidden>→</span>
          </Link>
        )}
        <Link to={mistakes > 0 ? '/mistakes' : '/subjects'} className="lift flex min-h-12 items-center rounded-2xl border-[1.5px] border-white/70 px-5 font-bold">
          {mistakes > 0 ? `Redo ${mistakes} mistake${mistakes === 1 ? '' : 's'}` : 'All subjects'}
        </Link>
      </div>
    </section>
  )
}

/** One item of today's plan: why it is there, what it is, and how long it takes. */
function PlanCard({ item, primary }: { item: PlanItem; primary: boolean }) {
  return (
    <Link to={item.to} className={`lift flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ${primary ? 'border-2 border-[color:var(--hero-2)]' : 'border border-rule'}`}>
      <span className="flex flex-grow flex-col gap-0.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">{item.label}</span>
        <span className="font-bold leading-snug">{item.title}{item.topicTitle ? <span className="font-normal text-ink-2"> · {item.topicTitle}</span> : null}</span>
        <span className="text-xs text-ink-2">{item.reason} About {item.minutes} min.</span>
      </span>
      <span className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold ${primary ? 'hero-gradient' : 'border border-rule'}`}>Go</span>
    </Link>
  )
}

function TaskCard({ task }: { task: Task }) {
  return (
    <Link to={task.to} style={{ '--subject': task.subjectColour } as React.CSSProperties} className="lift flex min-h-24 flex-col gap-1.5 rounded-2xl border border-rule bg-surface p-3 hover:border-[color:var(--subject)]">
      <span className="text-[11px] font-bold uppercase tracking-[0.06em] accent-ink">{task.subjectName} · {task.title}</span>
      <span className="font-bold leading-snug">{task.topic.title}</span>
      <span className="text-xs text-ink-2">{task.reason}</span>
    </Link>
  )
}

/** "Exam in 212 days", from a date the student gave; nothing for no date or one past. */
function examNote(iso: string | undefined): string | undefined {
  const d = iso ? daysUntil(iso) : undefined
  return d === undefined ? undefined : d === 0 ? 'Exam today' : `Exam in ${d} day${d === 1 ? '' : 's'}`
}

/**
 * The first visit (UXI-10): three questions before the dashboard, so the plan starts from
 * what the student actually takes. Skipping is one tap, and it is not asked again.
 */
function Welcome() {
  const progress = useProgress()
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold leading-tight">Welcome</h1>
        <p className="text-ink-2">Three quick questions, so your plan covers what you study. You can change any of it later in Settings.</p>
      </header>
      <ProfileForm profile={progress.profile ?? {}} saveLabel="Start" />
      <button type="button" onClick={() => setProfile({})} className="w-fit text-sm text-ink-3 underline underline-offset-2">Skip for now</button>
    </article>
  )
}
