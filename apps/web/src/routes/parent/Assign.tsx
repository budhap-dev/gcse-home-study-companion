import { useEffect, useMemo, useState } from 'react'
import { SUBJECTS, type SubjectId } from '@study/shared'
import { SectionLabel } from '../../components/KindChip.tsx'
import { AssignedCard } from '../../components/AssignedTasks.tsx'
import { topicsForSubject } from '../../content/index.ts'
import { createAssignment, deleteAssignment, listAssignments } from '../../auth/assignments.ts'
import { assignedTasks, type Assignment } from '../../progress/assignments.ts'
import { useAuth } from '../../auth/useAuth.ts'
import type { ProgressState } from '../../progress/store.ts'

const SUBJECTS_WITH_CONTENT = SUBJECTS.filter((s) => topicsForSubject(s.id).length > 0)

/**
 * Setting and clearing tasks for one child, and seeing how they are going.
 *
 * Whether a task is done is worked out from the child's own progress, which this screen
 * already holds, so nothing here writes to their record. That is why there is no "mark
 * complete" control: the only way a task finishes is the child doing it.
 */
export function AssignPanel({ email, name, state }: { email: string; name: string; state?: ProgressState }) {
  const auth = useAuth()
  const [list, setList] = useState<Assignment[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [subjectId, setSubjectId] = useState<SubjectId>(SUBJECTS_WITH_CONTENT[0]?.id ?? 'maths')
  const [topicId, setTopicId] = useState('')
  const [kind, setKind] = useState<Assignment['kind']>('lesson')
  const [level, setLevel] = useState<'core' | 'higher' | 'advanced'>('core')
  const [startsOn, setStartsOn] = useState('')
  const [dueOn, setDueOn] = useState('')
  const [note, setNote] = useState('')

  const topics = useMemo(() => topicsForSubject(subjectId), [subjectId])
  useEffect(() => { setTopicId(topics[0]?.id ?? '') }, [topics])

  const load = () => {
    listAssignments()
      .then((rows) => setList(rows.filter((r) => r.studentEmail === email)))
      .catch((e: Error) => setMessage(e.message))
  }
  useEffect(load, [email])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topicId || !auth.email) return
    setBusy(true)
    setMessage(null)
    if (startsOn && dueOn && dueOn < startsOn) { setBusy(false); setMessage('The finish date cannot be before the start date.'); return }
    const err = await createAssignment({ studentEmail: email, topicId, kind, level: kind === 'worksheet' ? level : undefined, startsOn, dueOn, note }, auth.email)
    setBusy(false)
    if (err) { setMessage(err); return }
    setMessage(`Set for ${name}.`)
    setNote('')
    setStartsOn('')
    setDueOn('')
    load()
  }

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`Remove "${title}" from ${name}'s tasks?`)) return
    const err = await deleteAssignment(id)
    if (err) setMessage(err)
    else load()
  }

  const tasks = assignedTasks(list, state ?? { attempts: [], lessons: {}, minutes: {}, goalMinutes: 180, daysOff: [], badges: {} })
  const field = 'h-11 rounded-lg border border-rule bg-surface px-3'

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel colour="#6B4E9B" emoji="📌">{`Tasks for ${name}`}</SectionLabel>

      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2 rounded-2xl border border-rule bg-surface p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold">Subject</span>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value as SubjectId)} className={field}>
              {SUBJECTS_WITH_CONTENT.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold">Topic</span>
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className={field}>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold">Activity</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as Assignment['kind'])} className={field}>
              <option value="lesson">Lesson</option>
              <option value="quiz">Quiz</option>
              <option value="worksheet">Worksheet</option>
            </select>
          </label>
          {kind === 'worksheet' && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-bold">Level</span>
              <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)} className={field}>
                <option value="core">Core</option>
                <option value="higher">Higher</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold">Start <span className="font-normal text-ink-2">(optional)</span></span>
            <input type="date" value={startsOn} max={dueOn || undefined} onChange={(e) => setStartsOn(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold">Finish by <span className="font-normal text-ink-2">(optional)</span></span>
            <input type="date" value={dueOn} min={startsOn || undefined} onChange={(e) => setDueOn(e.target.value)} className={field} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">Note <span className="font-normal text-ink-2">(optional, shown to {name})</span></span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="You scored 42% last time" className={field} />
        </label>
        <button type="submit" disabled={busy || !topicId} className="h-11 w-full rounded-lg bg-ink px-4 font-bold text-surface disabled:opacity-50 sm:w-40">
          {busy ? 'Setting…' : 'Set task'}
        </button>
        {message && <p className="text-sm" role="status">{message}</p>}
      </form>

      {tasks.length === 0 ? (
        <p className="text-sm text-ink-2">Nothing set yet. A task appears on {name}&rsquo;s home screen as soon as you add one.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((t) => (
            <li key={t.assignment.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1"><AssignedCard task={t} /></div>
              <button type="button" onClick={() => void remove(t.assignment.id, t.topicTitle)}
                className="mt-1 h-11 shrink-0 rounded-lg border border-rule px-3 text-xs font-bold text-status-not-secure">Remove</button>
            </li>
          ))}
        </ul>
      )}
      <p className="rounded-xl bg-panel px-4 py-3 text-xs text-ink-2">
        Leave both dates blank for &ldquo;whenever&rdquo;. A start date in the future shows the task to {name} but does not count it as outstanding until then.
        A task is marked done when {name} actually finishes that activity, not by ticking it off, and work done before you set the task does not count towards it.
      </p>
    </section>
  )
}
