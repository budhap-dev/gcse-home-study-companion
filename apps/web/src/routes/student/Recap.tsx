import { useState } from 'react'
import { Link } from 'react-router'
import { claimAnswer, getSubject, mark } from '@study/shared'
import type { Answer } from '../../components/questions/QuestionInput.tsx'
import { SessionQuestion } from '../../components/questions/SessionQuestion.tsx'
import { TOPICS, summaryById } from '../../content/index.ts'
import { useTopics } from '../../content/load.ts'
import { TopicLoading } from '../../components/TopicLoading.tsx'
import { loadInProgress, RECAP_KEY, saveInProgress } from '../../progress/inProgress.ts'
import { RECAP_MIN_TOPICS, recapItems, studied } from '../../progress/recap.ts'
import { itemKey, recordReview, type SessionAnswers, type SessionItem } from '../../progress/reviewSession.ts'
import { isoDate, type ProgressState } from '../../progress/store.ts'
import { useActivityTimer } from '../../progress/useActivityTimer.ts'
import { useProgress } from '../../progress/useProgress.ts'

interface Session {
  id: string
  day: string
  items: SessionItem[]
  index: number
  answers: SessionAnswers
  finishedAt?: string
}

const save = (s: Session | null) => saveInProgress(RECAP_KEY, s)
/** A recap left unfinished yesterday is yesterday's mix: today starts a new one. */
const load = () => {
  const s = loadInProgress<Session>(RECAP_KEY)
  return s && s.day === isoDate() ? s : null
}

/** Today's recap rounds so far: the questions asked, and how many were right. */
function today(state: ProgressState) {
  const day = isoDate()
  const asked = new Set<string>()
  let right = 0
  for (const a of state.attempts) {
    if (a.from !== 'recap' || isoDate(new Date(a.completedAt)) !== day) continue
    for (const q of a.questions ?? []) {
      asked.add(`${a.topicId}/${q.id}`)
      if (q.correct || q.claimed) right++
    }
  }
  return { asked, right }
}

const BUTTON = 'flex h-12 items-center justify-center rounded-xl px-5 font-bold'
/** A lone button keeps its own width; a pair stacks full width on a phone, as on Redo my mistakes. */
const LONE = `${BUTTON} w-fit bg-ink text-surface`

/**
 * The daily recap (QZ-3, TRK-3): five questions from topics already studied, a different mix
 * each day, asked one at a time and marked as they go. Bringing a topic back after a gap is
 * what makes it stay, and mixing topics is how the exam asks. Recorded like Redo my mistakes,
 * as a review per topic: it earns XP and counts as study, and a wrong answer joins the
 * mistakes list, but it never moves a topic's status.
 */
export function Recap() {
  const progress = useProgress()
  const [session, setSessionState] = useState<Session | null>(load)
  const setSession = (s: Session | null) => { save(s); setSessionState(s) }
  const done = today(progress)
  const ready = studied(TOPICS, progress).length >= RECAP_MIN_TOPICS
  const live = session && !session.finishedAt ? session : null
  const item = live?.items[live.index]
  const loaded = useTopics((session?.items ?? []).flatMap((m) => { const s = summaryById(m.topicId); return s ? [{ subjectId: s.subjectId, topicId: m.topicId }] : [] }))
  const topic = item ? loaded?.get(item.topicId) : undefined
  useActivityTimer(topic ? { subjectId: topic.subjectId, topicId: topic.id, kind: 'recap' } : undefined)

  const start = () => {
    const items = recapItems(TOPICS, progress, new Date(), done.asked)
    if (items.length) setSession({ id: crypto.randomUUID(), day: isoDate(), items, index: 0, answers: {} })
  }

  if (!session) {
    const roundDone = done.asked.size > 0
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <p className="text-xs font-bold uppercase tracking-[0.08em] accent-ink">Daily recap</p>
        <h1 className="text-3xl font-bold leading-tight">{roundDone ? "Today's recap is done" : 'Five questions, mixed'}</h1>
        {!ready ? (
          <>
            <p className="text-ink-2">The recap asks about topics you have already studied. Finish a lesson or a quiz in {RECAP_MIN_TOPICS} topics and it starts.</p>
            <Link to="/subjects" className={LONE}>Choose a topic</Link>
          </>
        ) : roundDone ? (
          <>
            <p className="text-ink-2"><strong className="text-ink">{done.right} of {done.asked.size}</strong> right today. A new mix is ready tomorrow, or have another five now.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={start} className={`${BUTTON} bg-ink text-surface`}>Another five</button>
              <Link to="/" className={`${BUTTON} border border-rule bg-surface`}>Home</Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-ink-2">
              One question from each of the topics you have studied that most need bringing back: the ones you saw longest ago, and the weaker ones sooner.
              Remembering something after a gap is what makes it stay. About five minutes.
            </p>
            <p className="text-sm text-ink-2">It earns XP and does not change any topic's status. A question you get wrong waits for you in Redo my mistakes.</p>
            <button type="button" onClick={start} className={LONE}>Start</button>
          </>
        )}
      </article>
    )
  }

  if (session.finishedAt) {
    const right = session.items.filter((m) => session.answers[itemKey(m)]?.result.correct || session.answers[itemKey(m)]?.result.claimed).length
    const wrong = session.items.length - right
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <p className="text-xs font-bold uppercase tracking-[0.08em] accent-ink">Daily recap</p>
        <h1 className="text-3xl font-bold leading-tight">{right} of {session.items.length} right</h1>
        <ul className="flex flex-col gap-2">
          {session.items.map((m) => {
            const s = summaryById(m.topicId)
            const ok = session.answers[itemKey(m)]?.result.correct || session.answers[itemKey(m)]?.result.claimed
            return (
              <li key={itemKey(m)} className="flex items-center gap-3 rounded-xl border border-rule bg-surface px-4 py-3">
                <span aria-hidden className={`w-5 shrink-0 text-center text-lg font-bold ${ok ? 'text-[color:var(--status-secure-ink)]' : 'text-[color:var(--status-not-secure-ink)]'}`}>{ok ? '✓' : '✗'}</span>
                <span className="sr-only">{ok ? 'Right:' : 'Wrong:'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-ink-2">{getSubject(s?.subjectId ?? '')?.name}</span>
                  {s ? <Link to={`/subjects/${s.subjectId}/topics/${s.id}`} className="font-bold underline">{s.title}</Link> : m.topicId}
                </span>
              </li>
            )
          })}
        </ul>
        <p className="text-ink-2">{wrong ? `The ${wrong === 1 ? 'one' : wrong} you got wrong ${wrong === 1 ? 'is' : 'are'} waiting in Redo my mistakes.` : 'All right. That is what remembering looks like.'} A new mix is ready tomorrow.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to="/" onClick={() => setSession(null)} className={`${BUTTON} bg-ink text-surface`}>Home</Link>
          <button type="button" onClick={start} className={`${BUTTON} border border-rule bg-surface`}>Another five</button>
        </div>
      </article>
    )
  }

  if (!loaded) return <TopicLoading />
  const question = topic?.questions.find((q) => q.id === item?.questionId)
  // The content changed under a saved session (a question removed by an update): start afresh.
  if (!live || !item || !topic || !question) {
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <p className="text-ink-2">This set of questions has changed since it was started.</p>
        <button type="button" onClick={() => setSession(null)} className={LONE}>Start again</button>
      </article>
    )
  }
  const answered = live.answers[itemKey(item)]
  const last = live.index === live.items.length - 1
  const submit = (answer: Answer) => setSession({ ...live, answers: { ...live.answers, [itemKey(item)]: { answer, result: mark(question, answer) } } })
  const claim = () => answered && setSession({ ...live, answers: { ...live.answers, [itemKey(item)]: { ...answered, result: claimAnswer(answered.result) } } })
  const next = () => {
    if (last) {
      const finishedAt = new Date().toISOString()
      recordReview(live.id, live.items, live.answers, (id) => loaded.get(id), finishedAt, 'recap')
      setSession({ ...live, finishedAt })
    } else {
      setSession({ ...live, index: live.index + 1 })
    }
    window.scrollTo({ top: 0 })
  }
  const subject = getSubject(topic.subjectId)

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5" style={{ '--subject': subject?.colour } as React.CSSProperties}>
      <header className="flex flex-col gap-1.5">
        <div className="flex justify-between gap-2 text-xs text-ink-2">
          <span className="font-bold uppercase tracking-[0.08em]">Daily recap</span>
          <span>{live.index + 1} of {live.items.length}</span>
        </div>
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${live.items.length}, minmax(0, 1fr))` }} role="progressbar" aria-valuemin={1} aria-valuemax={live.items.length} aria-valuenow={live.index + 1}>
          {live.items.map((m, i) => <span key={itemKey(m)} className="h-1.5 rounded-full" style={{ background: i <= live.index ? 'var(--subject)' : 'var(--color-rule)' }} />)}
        </div>
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
