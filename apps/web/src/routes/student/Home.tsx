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
import { evidenceFor, isoDate, streakDays, weekMinutes } from '../../progress/store.ts'
import { useProgress } from '../../progress/useProgress.ts'

export function Home() {
  const progress = useProgress()
  const { next, alternatives } = recommend(TOPICS, progress)
  const minutes = weekMinutes(progress)
  const goal = progress.goalMinutes
  const streak = streakDays(progress)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'
  const offToday = progress.daysOff.includes(isoDate())
  const levels = levelBySubject(progress)
  const badgeCount = Object.keys(progress.badges).length
  const auth = useAuth()
  const firstName = auth.status === 'allowed' && auth.name ? auth.name.split(' ')[0] : undefined
  const [factOffset, setFactOffset] = useState(0)
  const fact = factOfTheDay(SUBJECTS.filter((s) => topicsForSubject(s.id).length > 0).map((s) => s.id), new Date(), factOffset)

  return (
    <article className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-x-10 lg:gap-y-6">
      <div className="flex flex-col gap-6 lg:col-start-1">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-ink-2">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="flex items-center gap-2 text-3xl font-bold leading-tight">{greeting}{firstName ? `, ${firstName}` : ''}<Smiley bounce>{hour < 12 ? '🌞' : hour < 18 ? '👋' : '🌙'}</Smiley></h1>
          {firstName && <p className="text-sm text-ink-2">Welcome back. Your progress is saved to your account{auth.role === 'parent' ? ', and you can manage the family in Settings' : ''}.</p>}
        </div>
        <span className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
        <Link to="/progress" className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#e3c26a] bg-[#fff4cc] px-3 py-1.5 text-sm font-bold text-[#6b4d00]" title="XP and badges">
          <span className="text-ink-2">XP</span>{totalXp(progress)}
          <span className="ml-1 text-ink-2">·</span>{badgeCount}/{BADGES.length}
        </Link>
        <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#f2b08a] bg-[#ffe9dc] px-3 py-1.5 text-sm font-bold text-[#8a3b12]" title="Days in a row with something finished">
          <span className={streak > 0 ? 'anim-flicker' : ''}><Smiley>🔥</Smiley></span>
          {streak} day{streak === 1 ? '' : 's'}{streak >= 7 ? ' streak' : ''}
        </span>
        </span>
      </header>

      <section className="flex items-center gap-4 rounded-2xl border border-rule bg-surface px-4 py-3.5">
        <GoalRing minutes={minutes} goal={goal} />
        <div className="flex flex-col gap-0.5">
          <SectionLabel colour="#2e8b57" emoji="🎯">Weekly goal</SectionLabel>
          <p className="text-lg font-bold">{minutes} of {goal} minutes</p>
          <p className="text-sm text-ink-2">
            {offToday ? 'Today is a day off.' : minutes >= goal ? 'Goal reached this week.' : `${goal - minutes} minutes to go.`} <Link to="/settings" className="inline-block -my-1 py-1 underline">Change goal</Link>
          </p>
        </div>
      </section>

      {/* Above Next up: a task somebody asked for outranks one the app suggested. */}
      <SetForYou />

      {next ? (
        <section className="flex flex-col gap-2">
          <SectionLabel colour="#c8501f" emoji="🚀">Next up</SectionLabel>
          <TaskCard task={next} primary />
        </section>
      ) : (
        <p className="text-ink-2">No topics yet. They appear here as they are written.</p>
      )}

      {alternatives.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel colour="#1f3a93" emoji="🧭">Or choose</SectionLabel>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {alternatives.map((t) => (
              <TaskCard key={t.to} task={t} />
            ))}
          </div>
        </section>
      )}

      </div>

      <aside className="flex flex-col gap-6 lg:col-start-2 lg:row-start-1">
      {fact && (
        <section
          key={factOffset}
          className="anim-fade-up relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-5"
          style={{ '--subject': SUBJECTS.find((s) => s.id === fact.subjectId)?.colour, borderColor: 'color-mix(in srgb, var(--subject) 45%, transparent)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--subject) 18%, var(--color-surface)), var(--color-surface) 70%)' } as React.CSSProperties}
        >
          <span className="pointer-events-none absolute -right-4 -top-6 text-[7rem] opacity-15" aria-hidden><Smiley>💡</Smiley></span>
          <div className="flex items-center gap-2">
            <span className="chip" style={{ '--chip': 'var(--subject)' } as React.CSSProperties}><Smiley>💡</Smiley>Did you know</span>
            <span className="text-xs font-bold text-[color:var(--subject)]">{SUBJECTS.find((s) => s.id === fact.subjectId)?.name}</span>
          </div>
          <p className="relative text-[15px] leading-relaxed">{fact.text}</p>
          <button type="button" onClick={() => setFactOffset((n) => n + 1)} className="press relative w-fit rounded-full bg-[color:var(--subject)] px-4 py-1.5 text-sm font-bold text-white">
            Another one <span aria-hidden>→</span>
          </button>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionLabel colour="#6B4E9B" emoji="🏅">Your subjects</SectionLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {SUBJECTS.filter((s) => topicsForSubject(s.id).length > 0).map((s) => {
          const topics = topicsForSubject(s.id)
          const ready = topics.filter((t) => evidenceFor(t.id, progress).status === 'grade-9-ready').length
          const level = levels[s.id as SubjectId]
          return (
            <Link key={s.id} to={`/subjects/${s.id}`} className="flex flex-col gap-2 rounded-xl border border-rule bg-surface px-4 py-3" style={{ '--subject': s.colour } as React.CSSProperties}>
              <span className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-sm" style={{ background: s.colour }} aria-hidden />
                <span className="flex flex-grow flex-col"><span className="font-bold">{s.name}</span><span className="text-xs text-ink-2">{ready} of {topics.length} mastered</span></span>
                <span className="text-right text-xs"><span className="block font-bold" style={{ color: s.colour }}>{level ? level.name : 'Level 1'}</span><span className="text-ink-2">{level ? `${level.into} / ${level.span} XP` : 'no XP yet'}</span></span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-panel"><span className="anim-bar block h-full rounded-full" style={{ width: `${Math.round((level?.progress ?? 0) * 100)}%`, background: s.colour }} /></span>
            </Link>
          )
        })}
        </div>
      </section>
      </aside>
    </article>
  )
}

function TaskCard({ task, primary = false }: { task: Task; primary?: boolean }) {
  const style = { '--subject': task.subjectColour } as React.CSSProperties
  if (primary) {
    return (
      <Link to={task.to} style={style} className="press flex flex-col gap-3 rounded-2xl bg-[color:var(--subject)] p-5 text-white">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-md bg-white/20 px-2 py-0.5 font-bold uppercase tracking-[0.06em]">{task.subjectName}</span>
          <span className="opacity-90">{task.title} · about {task.minutes} min</span>
        </div>
        <span className="text-2xl font-bold leading-tight">{task.topic.title}</span>
        <span className="text-sm leading-snug opacity-95">{task.reason}</span>
        <span className="mt-1 flex h-12 items-center justify-center rounded-xl bg-white font-bold text-[color:var(--subject)]">Start</span>
      </Link>
    )
  }
  return (
    <Link to={task.to} style={style} className="flex min-h-24 flex-col gap-1.5 rounded-xl border border-rule bg-surface p-3 hover:border-[color:var(--subject)]">
      <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--subject)]">{task.subjectName} · {task.title}</span>
      <span className="font-bold leading-snug">{task.topic.title}</span>
      <span className="text-xs text-ink-2">{task.reason}</span>
    </Link>
  )
}

function GoalRing({ minutes, goal }: { minutes: number; goal: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  const frac = Math.min(1, goal > 0 ? minutes / goal : 0)
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="text-ink" role="img" aria-label={`${minutes} of ${goal} minutes this week`}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--color-rule)" strokeWidth="8" />
      <circle cx="38" cy="38" r={r} fill="none" stroke="#2E8B57" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 38 38)" style={{ transition: 'stroke-dasharray 0.9s ease-out' }} />
      <text x="38" y="42" textAnchor="middle" fontFamily="Bricolage Grotesque, Arial, sans-serif" fontSize="15" fontWeight="700" fill="currentColor">{Math.round(frac * 100)}%</text>
    </svg>
  )
}
