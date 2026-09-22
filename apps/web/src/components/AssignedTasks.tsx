import { Link } from 'react-router'
import { SectionLabel } from './KindChip.tsx'
import { assignedTasks, outstanding, upcoming, type AssignedTask } from '../progress/assignments.ts'
import { useMyAssignments } from '../auth/assignments.ts'
import { useProgress } from '../progress/useProgress.ts'

const DUE = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const PLAIN = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/**
 * The student's own assignments on their home screen.
 *
 * Renders nothing at all when there are none, rather than an empty heading: a student
 * with no tasks set should not be told about a feature that is not being used on them.
 */
export function SetForYou() {
  const progress = useProgress()
  const { list } = useMyAssignments()
  if (list.length === 0) return null
  const tasks = assignedTasks(list, progress)
  const todo = outstanding(tasks)
  const later = upcoming(tasks)
  // Three different things to say, and "all done" is only one of them: a term's work set
  // in advance has nothing to do yet and is not finished either.
  const heading = todo > 0 ? `Set for you · ${todo} to do`
    : later > 0 ? `Set for you · ${later} coming up`
    : 'Set for you · all done'
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel colour="#6B4E9B" emoji="📌">{heading}</SectionLabel>
      <ul className="flex flex-col gap-2">
        {tasks.map((t) => <li key={t.assignment.id}><AssignedCard task={t} /></li>)}
      </ul>
    </section>
  )
}

export function AssignedCard({ task }: { task: AssignedTask }) {
  const { assignment: a, task: card, status } = task
  const tone = status === 'overdue' ? 'border-status-not-secure' : status === 'due-today' ? 'border-[#c27a00]' : 'border-rule'
  const dim = status === 'upcoming' ? ' opacity-75' : ''
  const style = { '--subject': card?.subjectColour ?? '#6B4E9B' } as React.CSSProperties

  const inner = (
    <>
      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] accent-ink">
          {card ? `${card.subjectName} · ${card.title}` : 'Task'}
        </span>
        <Due status={status} startsOn={a.startsOn} dueOn={a.dueOn} doneAt={task.doneAt} />
      </span>
      <span className={`font-bold leading-snug ${status === 'done' ? 'text-ink-2 line-through' : ''}`}>{task.topicTitle}</span>
      {a.note && <span className="text-xs text-ink-2">{a.note}</span>}
      {/* The full window, only when both ends are set: the corner badge already carries
          whichever single date the student needs to act on. */}
      {a.startsOn && a.dueOn && status !== 'done' && (
        <span className="text-xs text-ink-3">Window: {PLAIN(a.startsOn)} to {PLAIN(a.dueOn)}</span>
      )}
      {card && status !== 'done' && <span className="text-xs text-ink-3">About {card.minutes} min</span>}
      {!card && <span className="text-xs text-ink-2">This topic is not in the app yet.</span>}
    </>
  )

  const shell = `flex min-h-24 flex-col gap-1.5 rounded-xl border bg-surface p-3 ${tone}${dim}`
  // A finished task, or one naming a topic this build does not carry, is not a link:
  // there is nothing useful to go to, and a dead-looking link is worse than plain text.
  return card && status !== 'done'
    ? <Link to={card.to} style={style} className={`${shell} hover:border-[color:var(--subject)]`}>{inner}</Link>
    : <div style={style} className={shell}>{inner}</div>
}

function Due({ status, startsOn, dueOn, doneAt }: { status: AssignedTask['status']; startsOn?: string; dueOn?: string; doneAt?: string }) {
  if (status === 'done') {
    return <span className="whitespace-nowrap text-xs font-bold text-[color:var(--status-secure-ink)]">✓ Done{doneAt ? ` ${DUE(doneAt.slice(0, 10))}` : ''}</span>
  }
  // Not started yet: the date that matters is when it opens, not when it closes.
  if (status === 'upcoming') return <span className="whitespace-nowrap text-xs font-bold text-ink-2">Starts {DUE(startsOn!)}</span>
  if (status === 'overdue') return <span className="whitespace-nowrap text-xs font-bold text-[color:var(--status-not-secure-ink)]">Was due {DUE(dueOn!)}</span>
  if (status === 'due-today') return <span className="whitespace-nowrap text-xs font-bold text-[#8a6d1d]">Due today</span>
  if (dueOn) return <span className="whitespace-nowrap text-xs text-ink-2">Due {DUE(dueOn)}</span>
  if (startsOn) return <span className="whitespace-nowrap text-xs text-ink-2">From {DUE(startsOn)}</span>
  return <span className="whitespace-nowrap text-xs text-ink-3">No date</span>
}
