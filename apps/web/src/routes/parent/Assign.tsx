import { useEffect, useMemo, useState } from 'react'
import { SUBJECTS, type SubjectId } from '@study/shared'
import { SectionLabel } from '../../components/KindChip.tsx'
import { AssignedCard } from '../../components/AssignedTasks.tsx'
import { topicsForSubject, yearsForSubject } from '../../content/index.ts'
import { TopicPicker, pickableTopics } from './TopicPicker.tsx'
import { createAssignment, deleteAssignment, listAssignments } from '../../auth/assignments.ts'
import { assignedTasks, type Assignment } from '../../progress/assignments.ts'
import { emptyState } from '../../progress/store.ts'
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
  const [year, setYear] = useState<number | undefined>(undefined)
  const [topicId, setTopicId] = useState('')
  const [kind, setKind] = useState<Assignment['kind']>('lesson')
  const [level, setLevel] = useState<'core' | 'higher' | 'advanced'>('core')
  const [startsOn, setStartsOn] = useState('')
  const [dueOn, setDueOn] = useState('')
  const [note, setNote] = useState('')

  // The child's progress, or an empty one when they have never signed in: the form still
  // has to work for an account with no history.
  const childState = state ?? emptyState()
  const topics = useMemo(() => pickableTopics(subjectId, childState, year), [subjectId, childState, year])
  const years = useMemo(() => yearsForSubject(subjectId), [subjectId])
  // Changing the subject or the year can leave a topic selected that is no longer on the
  // list, so the selection falls back to the first one that is.
  useEffect(() => {
    if (!topics.some((t) => t.id === topicId)) setTopicId(topics[0]?.id ?? '')
  }, [topics, topicId])
  // A year that the new subject does not teach would filter everything away.
  useEffect(() => { if (year && !years.includes(year)) setYear(undefined) }, [years, year])

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

  const again = async (t: (typeof tasks)[number]) => {
    if (!auth.email) return
    const a = t.assignment
    const err = await createAssignment({ studentEmail: email, topicId: a.topicId, kind: a.kind, level: a.level, note: a.note }, auth.email)
    setMessage(err ?? `Set again: ${t.topicTitle}.`)
    if (!err) load()
  }

  const tasks = assignedTasks(list, childState)
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
            <span className="font-bold">Year</span>
            <select value={year ?? ''} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : undefined)} className={field}>
              <option value="">All years</option>
              {years.map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </label>
          <TopicPicker subjectId={subjectId} state={childState} kind={kind} level={kind === 'worksheet' ? level : undefined} year={year} value={topicId} onChange={setTopicId} />
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
              <span className="mt-1 flex shrink-0 flex-col gap-1">
                {/* Finished work can be asked for again: the new task starts from now, so
                    the attempt that completed the old one does not count towards it. */}
                {t.status === 'done' && (
                  <button type="button" onClick={() => void again(t)}
                    className="h-11 rounded-lg border border-rule px-3 text-xs font-bold text-ink">Set again</button>
                )}
                <button type="button" onClick={() => void remove(t.assignment.id, t.topicTitle)}
                  className="h-11 rounded-lg border border-rule px-3 text-xs font-bold text-status-not-secure">Remove</button>
              </span>
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
