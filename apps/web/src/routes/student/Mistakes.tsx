import { useState } from 'react'
import { Link } from 'react-router'
import { claimAnswer, getSubject, mark } from '@study/shared'
import type { Answer } from '../../components/questions/QuestionInput.tsx'
import { SessionQuestion } from '../../components/questions/SessionQuestion.tsx'
import { summaryById } from '../../content/index.ts'
import { redoable } from '../../content/redoable.ts'
import { useTopics } from '../../content/load.ts'
import { TopicLoading } from '../../components/TopicLoading.tsx'
import { mistakeQueue, type Mistake } from '../../progress/mistakes.ts'
import { loadInProgress, MISTAKES_KEY, saveInProgress } from '../../progress/inProgress.ts'
import { getState } from '../../progress/store.ts'
import { itemKey, recordReview, type SessionAnswers } from '../../progress/reviewSession.ts'
import { useActivityTimer } from '../../progress/useActivityTimer.ts'
import { useProgress } from '../../progress/useProgress.ts'

interface Session {
  id: string
  items: Mistake[]
  index: number
  answers: SessionAnswers
  startedAt: string
  finishedAt?: string
  /** How many of the questions left the list with this session, worked out once it is recorded. */
  cleared?: number
}

const load = () => loadInProgress<Session>(MISTAKES_KEY)
const save = (s: Session | null) => saveInProgress(MISTAKES_KEY, s)

/**
 * Redo my mistakes (WKP-1): up to fifteen questions the student got wrong, from any topic,
 * newest first, asked one at a time and marked as they go. A question leaves the list once
 * it has been got right twice in a row, here or anywhere else. The session is recorded as
 * a "review" attempt per topic: it earns XP and counts as study, but it never moves a
 * topic's status, which stays with quizzes and worksheets.
 */
export function Mistakes() {
  const progress = useProgress()
  const [session, setSessionState] = useState<Session | null>(load)
  const setSession = (s: Session | null) => { save(s); setSessionState(s) }
  const queue = mistakeQueue(progress, redoable)
  const item = session && !session.finishedAt ? session.items[session.index] : undefined
  // Every topic in the session, fetched before it starts, so each question and the record at the end have their content.
  const loaded = useTopics((session && !session.finishedAt ? session.items : []).flatMap((m) => { const s = summaryById(m.topicId); return s ? [{ subjectId: s.subjectId, topicId: m.topicId }] : [] }))
  const topicById = (topicId: string) => loaded?.get(topicId)
  const topic = item ? topicById(item.topicId) : undefined
  useActivityTimer(topic ? { subjectId: topic.subjectId, topicId: topic.id, kind: 'review' } : undefined)

  const start = () => setSession({ id: crypto.randomUUID(), items: queue, index: 0, answers: {}, startedAt: new Date().toISOString() })

  if (!session) {
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h1 className="text-3xl font-bold leading-tight">Redo my mistakes</h1>
        {queue.length === 0 ? (
          <>
            <p className="text-ink-2">Nothing to redo. Questions you get wrong in quizzes and worksheets come here, and leave once you get them right twice in a row.</p>
            <Link to="/" className="w-fit rounded-lg bg-ink px-4 py-2 font-bold text-surface">Home</Link>
          </>
        ) : (
          <>
            <p className="text-ink-2">
              {queue.length} question{queue.length === 1 ? '' : 's'} you got wrong, newest first, from {new Set(queue.map((m) => m.topicId)).size} topic{new Set(queue.map((m) => m.topicId)).size === 1 ? '' : 's'}.
              Get one right twice in a row and it leaves the list. It earns XP, and it does not change any topic's status.
            </p>
            <button type="button" onClick={start} className="h-12 w-fit rounded-xl bg-ink px-5 font-bold text-surface">Start</button>
          </>
        )}
      </article>
    )
  }

  if (session.finishedAt) {
    const right = session.items.filter((m) => session.answers[itemKey(m)]?.result.correct).length
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h1 className="text-3xl font-bold leading-tight">Mistakes redone</h1>
        <p className="text-lg"><strong>{right} of {session.items.length}</strong> right this time.</p>
        <p className="text-ink-2">
          {session.cleared ? `${session.cleared} question${session.cleared === 1 ? '' : 's'} cleared from the list: right twice in a row. ` : ''}
          {queue.length ? `${queue.length} still to redo.` : 'Nothing left to redo.'}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {queue.length > 0 && <button type="button" onClick={start} className="h-12 rounded-xl bg-ink px-5 font-bold text-surface">Go again</button>}
          <Link to="/" onClick={() => setSession(null)} className="flex h-12 items-center justify-center rounded-xl border border-rule bg-surface px-5 font-bold">Home</Link>
        </div>
      </article>
    )
  }

  if (!loaded) return <TopicLoading />
  const question = topic?.questions.find((q) => q.id === item?.questionId)
  // The content changed under a saved session (a question removed by an update): start afresh.
  if (!item || !topic || !question) {
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <p className="text-ink-2">This set of questions has changed since it was started.</p>
        <button type="button" onClick={() => setSession(null)} className="h-12 w-fit rounded-xl bg-ink px-5 font-bold text-surface">Start again</button>
      </article>
    )
  }
  const answered = session.answers[itemKey(item)]
  const last = session.index === session.items.length - 1
  const submit = (answer: Answer) => setSession({ ...session, answers: { ...session.answers, [itemKey(item)]: { answer, result: mark(question, answer) } } })
  const claim = () => answered && setSession({ ...session, answers: { ...session.answers, [itemKey(item)]: { ...answered, result: claimAnswer(answered.result) } } })

  const finish = () => {
    const finishedAt = new Date().toISOString()
    const before = mistakeQueue(getState(), redoable, Infinity).length
    recordReview(session.id, session.items, session.answers, topicById, finishedAt)
    const after = mistakeQueue(getState(), redoable, Infinity).length
    setSession({ ...session, finishedAt, cleared: Math.max(0, before - after) })
    window.scrollTo({ top: 0 })
  }
  const next = () => {
    if (last) return finish()
    setSession({ ...session, index: session.index + 1 })
    window.scrollTo({ top: 0 })
  }
  const subject = getSubject(topic.subjectId)

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5" style={{ '--subject': subject?.colour } as React.CSSProperties}>
      <header className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-2">Redo my mistakes · {session.index + 1} of {session.items.length}</p>
        <p className="text-sm"><span className="font-bold accent-ink">{subject?.name}</span> · <Link to={`/subjects/${topic.subjectId}/topics/${topic.id}`} className="underline">{topic.title}</Link></p>
      </header>
      <SessionQuestion subjectId={topic.subjectId} topicId={topic.id} question={question} answered={answered} onSubmit={submit} onClaim={claim} />
      {answered && (
        <button type="button" onClick={next} className="h-12 rounded-xl bg-ink px-4 text-base font-bold text-surface">
          {last ? 'See how it went' : 'Next question'}
        </button>
      )}
    </article>
  )
}
