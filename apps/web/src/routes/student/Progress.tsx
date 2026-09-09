import { BADGES, STATUS_COLOUR, STATUS_LABEL, SUBJECTS, TOPIC_STATUSES, type SubjectId, LEVEL_NAMES } from '@study/shared'
import { SectionLabel } from '../../components/KindChip.tsx'
import { BadgeIcon } from '../../components/BadgeIcon.tsx'
import { Smiley } from '../../components/Smiley.tsx'
import { levelBySubject, skillStats, totalXp } from '../../progress/xp.ts'
import { Link } from 'react-router'
import { StatusIcon } from '../../components/StatusChip.tsx'
import { TOPICS, topicsForSubject } from '../../content/index.ts'
import { evidenceFor, isoDate, streakDays, weekDays, weekMinutes } from '../../progress/store.ts'
import { useProgress } from '../../progress/useProgress.ts'

export function Progress() {
  const progress = useProgress()
  const days = weekDays()
  const today = isoDate()
  const max = Math.max(30, ...days.map((d) => progress.minutes[d] ?? 0))
  const recent = [...progress.attempts].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 8)
  const titleOf = (id: string) => TOPICS.find((t) => t.id === id)?.title ?? id
  const levels = levelBySubject(progress)
  const { strengths, weaknesses } = skillStats(progress)
  const subjectName = (id: string) => SUBJECTS.find((s) => s.id === id)?.name ?? id

  return (
    <article className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold leading-tight">Progress</h1>
        <p className="text-ink-2">Saved on this device. {streakDays(progress)} day streak · {weekMinutes(progress)} of {progress.goalMinutes} minutes this week · {totalXp(progress)} XP.</p>
      </header>

      <section className="flex flex-col gap-3">
        <SectionLabel colour="#6B4E9B" emoji="🏅">Levels</SectionLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SUBJECTS.filter((s) => topicsForSubject(s.id).length > 0).map((s) => {
            const level = levels[s.id as SubjectId]
            return (
              <div key={s.id} className="flex flex-col gap-2 rounded-xl border border-rule bg-surface px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-bold" style={{ color: s.colour }}>{s.name}</span>
                  <span className="whitespace-nowrap text-sm"><strong>{level ? level.name : LEVEL_NAMES[s.id][0]}</strong> <span className="text-ink-2">· level {level?.level ?? 1}</span></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-panel"><div className="h-full rounded-full" style={{ width: `${Math.round((level?.progress ?? 0) * 100)}%`, background: s.colour }} /></div>
                <span className="text-xs text-ink-2">{level ? `${level.into} of ${level.span} XP to ${level.nextName}` : 'Finish a lesson or quiz to start'}</span>
              </div>
            )
          })}
        </div>
      </section>

      {(strengths.length > 0 || weaknesses.length > 0) && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-xl border border-rule bg-surface px-4 py-3">
            <SectionLabel colour="#2e8b57" emoji="💪">Strengths</SectionLabel>
            {strengths.length === 0 ? <p className="text-sm text-ink-2">Not enough answers yet.</p> : (
              <ul className="flex flex-col gap-1 text-sm">{strengths.map((x) => <li key={x.subjectId + x.skill} className="flex justify-between gap-2"><span>{x.skill} <span className="text-ink-3">· {subjectName(x.subjectId)}</span></span><strong className="tabular-nums">{x.pct}%</strong></li>)}</ul>
            )}
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-rule bg-surface px-4 py-3">
            <SectionLabel colour="#d25b3b" emoji="🎯">Work on next</SectionLabel>
            {weaknesses.length === 0 ? <p className="text-sm text-ink-2">Nothing below 60% yet.</p> : (
              <ul className="flex flex-col gap-1 text-sm">{weaknesses.map((x) => <li key={x.subjectId + x.skill} className="flex justify-between gap-2"><span>{x.skill} <span className="text-ink-3">· {subjectName(x.subjectId)}</span></span><strong className="tabular-nums">{x.pct}%</strong></li>)}</ul>
            )}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionLabel colour="#c8501f" emoji="🏆">{`Badges · ${Object.keys(progress.badges).length} of ${BADGES.length}`}</SectionLabel>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {BADGES.map((b) => {
            const earned = Boolean(progress.badges[b.id])
            return (
              <li key={b.id} className={`flex items-center gap-3 rounded-xl border border-rule px-3 py-2 ${earned ? 'bg-surface' : 'bg-panel/60'}`} title={b.description}>
                <span className="relative"><BadgeIcon earned={earned} /><Smiley className="absolute -right-1 -top-1 text-sm">{earned ? b.emoji : ''}</Smiley></span>
                <span className="flex flex-col"><span className={`text-sm font-bold ${earned ? '' : 'text-ink-2'}`}>{b.name}</span><span className="text-[11px] text-ink-2">{earned ? new Date(progress.badges[b.id]!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : b.description}</span></span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-rule bg-surface p-4">
        <SectionLabel colour="#1f3a93" emoji="📅">This week</SectionLabel>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => {
            const m = progress.minutes[d] ?? 0
            const off = progress.daysOff.includes(d)
            return (
              <div key={d} className="flex flex-col items-center gap-1">
                <div className="flex h-24 w-full items-end rounded-md bg-panel">
                  <div className="w-full rounded-md" style={{ height: `${Math.round((100 * m) / max)}%`, background: off ? 'var(--color-rule)' : 'var(--color-status-secure)' }} title={`${m} min`} />
                </div>
                <span className={`text-[11px] ${d === today ? 'font-bold' : 'text-ink-2'}`}>{new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2)}</span>
                <span className="text-[11px] tabular-nums text-ink-2">{off ? 'off' : m}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel colour="#0f766e" emoji="📊">Topics by status</SectionLabel>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
          {TOPIC_STATUSES.map((s) => (
            <li key={s} className="flex items-center gap-1.5"><StatusIcon status={s} size={12} />{STATUS_LABEL[s]}</li>
          ))}
        </ul>
        {SUBJECTS.filter((s) => topicsForSubject(s.id).length > 0).map((s) => {
          const topics = topicsForSubject(s.id)
          const counts = TOPIC_STATUSES.map((st) => topics.filter((t) => evidenceFor(t.id, progress).status === st).length)
          return (
            <Link key={s.id} to={`/subjects/${s.id}`} className="flex flex-col gap-2 rounded-xl border border-rule bg-surface px-4 py-3">
              <div className="flex items-center justify-between"><span className="font-bold" style={{ color: s.colour }}>{s.name}</span><span className="text-xs text-ink-2">{counts[3]} of {topics.length} Grade 9 ready</span></div>
              <div className="flex h-3 overflow-hidden rounded-full bg-panel">
                {[3, 2, 1, 0].map((i) => (
                  <span key={i} style={{ width: `${(100 * counts[i]!) / topics.length}%`, background: STATUS_COLOUR[TOPIC_STATUSES[i]!] }} />
                ))}
              </div>
            </Link>
          )
        })}
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel colour="#c27a00" emoji="🕒">Recent</SectionLabel>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-2">Nothing finished yet. A quiz or worksheet shows up here.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg border border-rule bg-surface px-3 py-2 text-sm">
                <span>{titleOf(a.topicId)} · {a.kind === 'quiz' ? 'Quiz' : `${a.level![0]!.toUpperCase()}${a.level!.slice(1)} worksheet`}<span className="text-ink-2"> · {a.markedHow === 'auto' ? 'auto-marked' : a.markedHow === 'self' ? 'self-marked' : 'mixed'}</span></span>
                <span className="font-bold tabular-nums">{Math.round((100 * a.marksScored) / a.marksAvailable)}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  )
}
