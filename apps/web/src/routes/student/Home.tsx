import { SUBJECTS } from '@study/shared'
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

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-ink-2">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-3xl font-bold leading-tight">{greeting}</h1>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-rule bg-surface px-3 py-1.5 text-sm font-bold" title="Days in a row with something finished">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D9A21B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 1-3-1-6 1-9z" /></svg>
          {streak} day{streak === 1 ? '' : 's'}
        </span>
      </header>

      <section className="flex items-center gap-4 rounded-2xl border border-rule bg-surface px-4 py-3.5">
        <GoalRing minutes={minutes} goal={goal} />
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-2">Weekly goal</p>
          <p className="text-lg font-bold">{minutes} of {goal} minutes</p>
          <p className="text-sm text-ink-2">
            {offToday ? 'Today is a day off.' : minutes >= goal ? 'Goal reached this week.' : `${goal - minutes} minutes to go.`} <Link to="/settings" className="underline">Change goal</Link>
          </p>
        </div>
      </section>

      {next ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-2">Next up</h2>
          <TaskCard task={next} primary />
        </section>
      ) : (
        <p className="text-ink-2">No topics yet. They appear here as they are written.</p>
      )}

      {alternatives.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-2">Or choose</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {alternatives.map((t) => (
              <TaskCard key={t.to} task={t} />
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SUBJECTS.filter((s) => topicsForSubject(s.id).length > 0).map((s) => {
          const topics = topicsForSubject(s.id)
          const ready = topics.filter((t) => evidenceFor(t.id, progress).status === 'grade-9-ready').length
          return (
            <Link key={s.id} to={`/subjects/${s.id}`} className="flex items-center gap-3 rounded-xl border border-rule bg-surface px-4 py-3">
              <span className="h-3 w-3 rounded-sm" style={{ background: s.colour }} aria-hidden />
              <span className="flex flex-col"><span className="font-bold">{s.name}</span><span className="text-xs text-ink-2">{ready} of {topics.length} Grade 9 ready</span></span>
            </Link>
          )
        })}
      </section>
    </article>
  )
}

function TaskCard({ task, primary = false }: { task: Task; primary?: boolean }) {
  const style = { '--subject': task.subjectColour } as React.CSSProperties
  if (primary) {
    return (
      <Link to={task.to} style={style} className="flex flex-col gap-3 rounded-2xl bg-[color:var(--subject)] p-5 text-white">
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
    <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`${minutes} of ${goal} minutes this week`}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="#ECE9E1" strokeWidth="8" />
      <circle cx="38" cy="38" r={r} fill="none" stroke="#2E8B57" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 38 38)" />
      <text x="38" y="42" textAnchor="middle" fontFamily="Bricolage Grotesque, Arial, sans-serif" fontSize="15" fontWeight="700" fill="#1E2330">{Math.round(frac * 100)}%</text>
    </svg>
  )
}
