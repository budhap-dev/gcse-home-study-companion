import { BADGES, SUBJECTS, factOfTheDay, type SubjectId } from '@study/shared'
import { SectionLabel } from '../../components/KindChip.tsx'
import { SetForYou } from '../../components/AssignedTasks.tsx'
import { useAuth } from '../../auth/useAuth.ts'
import { useState } from 'react'
import { closestLevelUp, levelBySubject, totalXp } from '../../progress/xp.ts'
import { Smiley } from '../../components/Smiley.tsx'
import { Link } from 'react-router'
import { TOPICS, topicsForSubject } from '../../content/index.ts'
import { recommend, type Task } from '../../progress/recommend.ts'
import { goalDays, isoDate, setProfile, streakDays } from '../../progress/store.ts'
import { countLevels, daysThisWeek, fixFirst, isSecure, lastDays, square } from '../../progress/map.ts'
import { MapLegend, SubjectMapCard, WeekBars } from '../../components/map/MapParts.tsx'
import { ProfileForm } from '../../components/ProfileForm.tsx'
import { useProgress } from '../../progress/useProgress.ts'
import { mistakeQueue } from '../../progress/mistakes.ts'
import { redoable } from '../../content/redoable.ts'
import { doneToday, todayPlan, type PlanItem } from '../../progress/today.ts'
import { assignedTasks } from '../../progress/assignments.ts'
import { useMyAssignments } from '../../auth/assignments.ts'
import { SubjectTile, useRandomIcon } from '../../components/SubjectTile.tsx'
import { HeroCharts } from '../../components/HeroCharts.tsx'
import { useWide } from '../../components/useWide.ts'
import { GoodDeed } from '../../components/GoodDeed.tsx'
import { Thought } from '../../components/Thought.tsx'

/**
 * Home as the map (Option C). A banner with the day's numbers and the first thing to do,
 * with the thought and the fact of the day under it; today's plan, the good deed and the
 * week's minutes beside them; then every topic of every subject as a square, shaded by how
 * well it is known, so the gaps show at a glance. Set tasks and the weakest started topics
 * come after.
 */
export function Home() {
  const progress = useProgress()
  const profile = progress.profile ?? {}
  const { next, alternatives } = recommend(TOPICS, progress)
  const mistakes = mistakeQueue(progress, redoable)
  const { list: assignments } = useMyAssignments()
  const plan = todayPlan(TOPICS, progress, assignedTasks(assignments, progress), mistakes.length)
  const done = doneToday(TOPICS, progress)
  const others = alternatives.filter((t) => !plan.some((p) => p.to === t.to))
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const levels = levelBySubject(progress)
  const auth = useAuth()
  const firstName = auth.status === 'allowed' && auth.name ? auth.name.split(' ')[0] : undefined
  const [factOffset, setFactOffset] = useState(0)
  const fact = factOfTheDay(SUBJECTS.filter((s) => topicsForSubject(s.id).length > 0).map((s) => s.id), new Date(), factOffset)

  // The map: every topic of every subject, one square each.
  const mapped = SUBJECTS.filter((s) => topicsForSubject(s.id).length > 0)
    .map((s) => ({ subject: s, squares: topicsForSubject(s.id).map((t) => square(t, progress)) }))
  // Anything already in today's plan is not offered twice.
  const fix = fixFirst(TOPICS, progress, new Date(), 6).filter((f) => !plan.some((p) => p.to === f.to)).slice(0, 3)

  const wide = useWide()
  const levelUp = closestLevelUp(progress, mapped.map((m) => m.subject.id))

  const fresh = !profile.setupAt && progress.attempts.length === 0 && Object.keys(progress.lessons).length === 0
  if (fresh) return <Welcome />

  return (
    <article className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-x-8">
      {/* On a laptop, two columns that each keep to their own height: the banner with the
          day's reading under it, and beside them what to do today; the map then runs across
          both. On a phone the two wrappers dissolve and each card takes its turn in the one
          column by its order: the plan and the deed straight after the banner, the reading
          and the week's minutes at the end. */}
      <div className="contents lg:flex lg:flex-col lg:gap-5">
        <Hero
          greeting={`${greeting}${firstName ? `, ${firstName}` : ''}`}
          welcome={firstName ? `Welcome back. Your progress is saved to your account${auth.role === 'parent' ? ', and you can manage the family in Settings' : ''}.` : undefined}
          streak={streakDays(progress)}
          minutes={progress.minutes[isoDate()] ?? 0}
          goal={progress.dailyGoalMinutes}
          offToday={progress.daysOff.includes(isoDate())}
          secure={mapped.reduce((n, m) => n + m.squares.filter(isSecure).length, 0)}
          xp={totalXp(progress)}
          badges={`${Object.keys(progress.badges).length} of ${BADGES.length}`}
          first={plan[0]}
          mistakes={mistakes.length}
          tiles={mapped.slice(0, 6).map((m) => ({ id: m.subject.id, colour: m.subject.colour }))}
          charts={
            <HeroCharts
              days={lastDays(progress)}
              goal={progress.dailyGoalMinutes}
              levels={countLevels(mapped.flatMap((m) => m.squares))}
              levelUp={levelUp && { ...levelUp, name: mapped.find((m) => m.subject.id === levelUp.subjectId)!.subject.name }}
            />
          }
        />

        <div className="max-lg:order-9"><Thought /></div>

        {fact && (
          <section
            key={factOffset}
            className="anim-fade-up relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-5 max-lg:order-10 lg:flex-row lg:items-center lg:gap-6"
            style={{ '--subject': SUBJECTS.find((s) => s.id === fact.subjectId)?.colour, borderColor: 'color-mix(in srgb, var(--subject) 45%, transparent)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--subject) 18%, var(--color-surface)), var(--color-surface) 70%)' } as React.CSSProperties}
          >
            <span className="pointer-events-none absolute -right-4 -top-6 text-[7rem] opacity-15" aria-hidden><Smiley>💡</Smiley></span>
            <div className="relative flex min-w-0 flex-grow flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="chip" style={{ '--chip': 'var(--subject)' } as React.CSSProperties}><Smiley>💡</Smiley>Did you know</span>
                <span className="text-xs font-bold accent-ink">{SUBJECTS.find((s) => s.id === fact.subjectId)?.name}</span>
              </div>
              <p className="text-[15px] leading-relaxed">{fact.text}</p>
            </div>
            <button type="button" onClick={() => setFactOffset((n) => n + 1)} className="press relative w-fit shrink-0 rounded-full bg-[color:var(--subject)] px-4 py-1.5 text-sm font-bold text-white">
              Another one <span aria-hidden>→</span>
            </button>
          </section>
        )}
      </div>

      <div className="contents lg:flex lg:flex-col lg:gap-5">
        {plan.length > 0 ? (
          // Below laptop width the first item is in the banner (HeroPlan), so the list here
          // starts at the second and goes when there is nothing else to show.
          <section className={`anim-rise flex flex-col gap-2 max-lg:order-2 ${plan.length === 1 && done.length === 0 ? 'max-lg:hidden' : ''}`} style={{ '--d': '0.08s' } as React.CSSProperties}>
            <SectionLabel colour="#c8501f" emoji="🚀">Today</SectionLabel>
            {plan.map((item, i) => <PlanCard key={item.to} item={item} primary={i === 0} className={i === 0 ? 'max-lg:hidden' : ''} />)}
            {done.length > 0 && (
              <p className="text-sm text-ink-2">
                <strong className="text-ink">Done today:</strong> {done.map((d) => `${d.what} · ${d.topicTitle}${d.detail ? ` (${d.detail})` : ''}`).join('; ')}.
              </p>
            )}
          </section>
        ) : !next && (
          <p className="text-ink-2 max-lg:order-2">No topics yet. They appear here as they are written.</p>
        )}
        {/* The day's good deed sits under the plan: it is a thing to do today, and here it
            is near the top of a phone and beside the banner on a laptop, where the evening's
            question is seen. */}
        <div className="max-lg:order-3"><GoodDeed /></div>
        {/* Every task a parent set, done or not, below the plan that picks the most pressing one.
            On a laptop the list goes below the map instead: beside the banner it made this
            column far taller than the banner, and the map waited for it to end. */}
        {!wide && <SetForYou className="max-lg:order-4" />}

        <section className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4 max-lg:order-11">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-sans text-sm font-bold text-ink-2">This week, minutes a day</h2>
            <Link to="/settings" className="-my-2 inline-block py-2 text-xs text-ink-2 underline">Change goal</Link>
          </div>
          <WeekBars days={daysThisWeek(progress)} goal={progress.dailyGoalMinutes} />
          <p className="text-xs text-ink-2">{weekGoalLine(goalDays(progress), progress.dailyGoalMinutes)}</p>
        </section>
      </div>

      {!profile.setupAt && (
        <Link to="/settings#you" className="lift flex items-center gap-3 rounded-2xl border border-dashed border-rule bg-surface px-4 py-3 max-lg:order-5 lg:col-span-2">
          <span className="flex flex-grow flex-col gap-0.5">
            <span className="font-bold">Tell the app your school year</span>
            <span className="text-xs text-ink-2">So the plan starts on your year’s topics. One tap.</span>
          </span>
          <span className="rounded-lg border border-rule px-3 py-1.5 text-sm font-bold">Set up</span>
        </Link>
      )}

      <section className="flex flex-col gap-3 max-lg:order-6 lg:col-span-2" aria-labelledby="map-heading">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
          <h2 id="map-heading" className="text-[22px] font-bold leading-tight">
            Your map <span className="font-sans text-[15px] font-normal text-ink-2">· every topic, every subject</span>
          </h2>
          <MapLegend />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {mapped.map((m, i) => (
            <SubjectMapCard key={m.subject.id} subject={m.subject} squares={m.squares} index={i} level={levels[m.subject.id as SubjectId]} />
          ))}
        </div>
      </section>

      {/* What else there is to do runs the full width under the map, so nothing sits beside
          an empty column: the set tasks on a laptop, the weakest topics, and the other choices. */}
      {wide && <SetForYou className="lg:col-span-2" />}

      {fix.length > 0 && (
        <section className="flex flex-col gap-2 max-lg:order-7 lg:col-span-2">
          <SectionLabel colour="#d25b3b" emoji="🩹">Fix these first</SectionLabel>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
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
        <section className="flex flex-col gap-2 max-lg:order-8 lg:col-span-2">
          <SectionLabel colour="#1f3a93" emoji="🧭">Or choose</SectionLabel>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {others.map((t) => <TaskCard key={t.to} task={t} />)}
          </div>
        </section>
      )}
    </article>
  )
}

/**
 * The banner at the top of Home: the day, a greeting, four numbers the student cares about,
 * and the first thing to do. Tiles in the subjects' own colours drift beside the words on
 * wide screens, where there is room for them. Below laptop width the numbers are one small
 * line and the first thing to do is a card with its reason and its time: a new or lapsed
 * student read four large zeros before anything to do, and the plan began under the fold.
 */
function Hero({ greeting, welcome, streak, minutes, goal, offToday, secure, xp, badges, first, mistakes, tiles, charts }: {
  greeting: string; welcome?: string; streak: number; minutes: number; goal: number; offToday: boolean
  secure: number; xp: number; badges: string; first?: PlanItem; mistakes: number; tiles: { id: string; colour: string }[]
  /**
   * Charts under the buttons on a laptop. The banner keeps to its own height: the reading
   * cards under it take up what the plan column leaves, so a long plan (fifteen set tasks,
   * once) never stretches it to a screen tall.
   */
  charts?: React.ReactNode
}) {
  const hour = new Date().getHours()
  const met = minutes >= goal
  const stats: [string, React.ReactNode][] = [
    [streak === 1 ? 'day streak' : 'days streak', <><span className={streak > 0 ? 'anim-flicker inline-block' : 'inline-block'}><Smiley>🔥</Smiley></span>{streak}</>],
    [met ? 'minutes today · goal met' : offToday ? 'minutes · today is a day off' : 'minutes today', <>{met && <Smiley>✅</Smiley>}{minutes}<span className="text-base font-normal"> / {goal}</span></>],
    ['topics secure', secure],
    [`XP · ${badges} badges`, xp.toLocaleString('en-GB')],
  ]
  // The same four, short enough for one line of a phone's banner.
  const brief: [string, React.ReactNode][] = [
    [streak === 1 ? 'day streak' : 'days streak', <><Smiley>🔥</Smiley>{streak}</>],
    [met ? 'min today, goal met' : offToday ? 'min, a day off' : 'min today', `${minutes}/${goal}`],
    ['secure', secure],
    ['XP', xp.toLocaleString('en-GB')],
  ]
  return (
    <section className="hero-gradient anim-rise relative flex flex-col gap-4 overflow-hidden rounded-[26px] p-5 shadow-[0_16px_40px_rgb(90_75_209/0.28)] sm:p-7">
      <span className="hero-shine" aria-hidden />
      {/* The student's subjects, each on a floating tile: a row across the top of the banner,
          and on a wide screen a column beside the text instead. */}
      {tiles.length > 0 && (
        <span aria-hidden className="pointer-events-none relative flex flex-wrap gap-2.5 pt-1 xl:hidden">
          {tiles.map((t, i) => <HeroTile key={t.id} tile={t} i={i} />)}
        </span>
      )}
      <div className="relative flex flex-col gap-4">
        {tiles.length > 0 && (
          <span aria-hidden className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 grid-cols-2 gap-3 xl:grid">
            {tiles.map((t, i) => <HeroTile key={t.id} tile={t} i={i} big />)}
          </span>
        )}
        <div className="relative flex flex-col gap-1 xl:pr-36">
          <p className="text-xs font-bold uppercase tracking-[0.12em]">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="flex flex-wrap items-center gap-2 text-[32px] font-bold leading-[1.05] sm:text-[42px]">
            {greeting}<Smiley bounce>{hour < 12 ? '🌞' : hour < 18 ? '👋' : '🌙'}</Smiley>
          </h1>
          {welcome && <p className="text-sm">{welcome}</p>}
        </div>
        <dl className="relative flex flex-wrap gap-x-4 gap-y-1 text-[13px] lg:hidden">
          {brief.map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-1">
              <dt className="order-2">{label}</dt>
              <dd className="order-1 flex items-center font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <dl className="relative hidden lg:flex lg:flex-wrap lg:gap-x-9 xl:pr-36">
          {stats.map(([label, value]) => (
            <div key={label} className="flex flex-col-reverse">
              <dt className="text-[13px]">{label}</dt>
              <dd className="flex items-center gap-1 font-display text-[28px] font-bold leading-tight tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {first && <HeroPlan item={first} />}
        <div className="relative flex flex-wrap gap-3 xl:pr-36">
          {first && (
            <Link to={first.to} className="lift hidden min-h-12 max-w-full items-center gap-2 rounded-2xl bg-white px-5 py-2 font-bold text-[#2a2f9e] shadow-[0_8px_20px_rgb(0_0_0/0.2)] lg:flex">
              <span className="truncate">{first.title}{first.topicTitle ? `: ${first.topicTitle}` : ''}</span>
              <span aria-hidden>→</span>
            </Link>
          )}
          <Link to={mistakes > 0 ? '/mistakes' : '/subjects'} className="lift flex min-h-12 items-center rounded-2xl border-[1.5px] border-white/70 px-5 font-bold">
            {mistakes > 0 ? `Redo ${mistakes} mistake${mistakes === 1 ? '' : 's'}` : 'All subjects'}
          </Link>
        </div>
      </div>
      {charts}
    </section>
  )
}

/** Under the week's bars: how many days so far reached the goal, in a sentence. */
function weekGoalLine({ met, of }: { met: number; of: number }, goal: number): string {
  if (of === 0) return `Goal: ${goal} minutes a day. The bar turns green when a day reaches it.`
  if (met === of) return `${goal} minutes reached on every day so far this week.`
  return `${goal} minutes reached on ${met} of ${of} ${of === 1 ? 'day' : 'days'} so far this week.`
}

/** A tile on the Home banner, with one of its subject's pictures chosen afresh on each visit. */
function HeroTile({ tile, i, big = false }: { tile: { id: string; colour: string }; i: number; big?: boolean }) {
  return <SubjectTile subjectId={tile.id} colour={tile.colour} variant={useRandomIcon(tile.id)} i={i} big={big} />
}

/** What a plan card says: why it is there, what it is, and how long it takes. */
function PlanLines({ item }: { item: PlanItem }) {
  return (
    <span className="flex min-w-0 flex-grow flex-col gap-0.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">{item.label}{item.subject ? ` · ${item.subject}` : ''}</span>
      <span className="font-bold leading-snug">{item.title}{item.topicTitle ? <span className="font-normal text-ink-2"> · {item.topicTitle}</span> : null}</span>
      <span className="text-xs text-ink-2">{item.reason} About {item.minutes} min.</span>
    </span>
  )
}

/** One item of today's plan, in the Today list. */
function PlanCard({ item, primary, className = '' }: { item: PlanItem; primary: boolean; className?: string }) {
  return (
    <Link to={item.to} className={`lift flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ${primary ? 'border-2 border-[color:var(--hero-2)]' : 'border border-rule'} ${className}`}>
      <PlanLines item={item} />
      <span className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold ${primary ? 'hero-gradient' : 'border border-rule'}`}>Go</span>
    </Link>
  )
}

/** The first item of today's plan, in the banner below laptop width: a card on the gradient. */
function HeroPlan({ item }: { item: PlanItem }) {
  return (
    <Link to={item.to} className="lift relative flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-ink shadow-[0_8px_20px_rgb(0_0_0/0.2)] lg:hidden">
      <PlanLines item={item} />
      <span className="hero-gradient shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold">Go</span>
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

/**
 * The first visit (UXI-10): one question before the dashboard, so the plan starts on the
 * student's own year. Skipping is one tap, and it is not asked again.
 */
function Welcome() {
  const progress = useProgress()
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold leading-tight">Welcome</h1>
        <p className="text-ink-2">One quick question, so your plan starts on your year. You can change it later in Settings.</p>
      </header>
      <ProfileForm profile={progress.profile ?? {}} saveLabel="Start" />
      <button type="button" onClick={() => setProfile({})} className="-my-2 min-h-11 w-fit text-sm text-ink-3 underline underline-offset-2">Skip for now</button>
    </article>
  )
}
