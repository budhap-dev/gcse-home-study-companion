import { emojiForScore, getSubject, mark, messageForScore, sampleQuestions, type MarkResult, type Question } from '@study/shared'
import { SectionLabel } from '../../components/KindChip.tsx'
import { Smiley } from '../../components/Smiley.tsx'
import { Celebration } from '../../components/Celebration.tsx'
import { settle, type Settlement } from '../../progress/settle.ts'
import { xpForQuestions } from '../../progress/xp.ts'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { RichText } from '../../components/RichText.tsx'
import { Visual } from '../../components/Visual.tsx'
import { Feedback } from '../../components/questions/Feedback.tsx'
import { QuestionInput, type Answer } from '../../components/questions/QuestionInput.tsx'
import { getTopic } from '../../content/index.ts'
import { getState, recordAttempt } from '../../progress/store.ts'
import { useActivityTimer } from '../../progress/useActivityTimer.ts'

interface Answered {
  answer: Answer
  result: MarkResult
}

interface QuizState {
  attemptId: string
  questionIds: string[]
  index: number
  answers: Record<string, Answered>
  startedAt: string
  finishedAt?: string
  /** Set when the attempt is recorded, so the summary can show what it earned. */
  earned?: { xp: number; previousPct?: number; badges: string[]; levelUp?: string }
}

const key = (topicId: string) => `study-companion.quiz.${topicId}`

function load(topicId: string): QuizState | null {
  try {
    const raw = sessionStorage.getItem(key(topicId))
    return raw ? (JSON.parse(raw) as QuizState) : null
  } catch {
    return null
  }
}
function save(topicId: string, state: QuizState | null) {
  try {
    if (state) sessionStorage.setItem(key(topicId), JSON.stringify(state))
    else sessionStorage.removeItem(key(topicId))
  } catch {
    // session storage unavailable: the quiz still works, it just will not survive a refresh
  }
}

function newQuiz(questionIds: string[], size: number): QuizState {
  const attemptId = crypto.randomUUID()
  return { attemptId, questionIds: sampleQuestions(questionIds, size, attemptId), index: 0, answers: {}, startedAt: new Date().toISOString() }
}

/**
 * Ten to twenty questions drawn from the topic's pool, marked as each is answered.
 * Every answer is kept in session storage, so a refresh loses nothing. The finished
 * attempt is recorded in progress and feeds the topic's status.
 */
export function Quiz() {
  const { subjectId, topicId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  const topic = subjectId && topicId ? getTopic(subjectId, topicId) : undefined
  const [state, setState] = useState<QuizState | null>(() => (topic ? load(topic.id) : null))
  const [celebration, setCelebration] = useState<Settlement | null>(null)
  useActivityTimer(Boolean(state && !state.finishedAt))

  useEffect(() => {
    if (topic) save(topic.id, state)
  }, [topic, state])

  const byId = useMemo(() => new Map(topic?.questions.map((q) => [q.id, q]) ?? []), [topic])
  if (!subject || !topic) return <p>Unknown topic.</p>
  const backTo = `/subjects/${subject.id}/topics/${topic.id}`
  const minutes = Math.max(5, Math.round(topic.quiz.sampleSize * 0.8))

  const start = () => setState(newQuiz(topic.quiz.questionIds, topic.quiz.sampleSize))

  if (!state) {
    return (
      <Intro subjectName={subject.name} title={topic.title} count={topic.quiz.sampleSize} pool={topic.quiz.questionIds.length} minutes={minutes} onStart={start} backTo={backTo} />
    )
  }

  const questions = state.questionIds.map((id) => byId.get(id)).filter((q): q is Question => Boolean(q))
  if (state.finishedAt) {
    return (
      <>
        {celebration && (
          <Celebration
            title={celebration.levelUp ? `Level up: ${celebration.levelUp.level.name}` : celebration.newBadges[0]!.name}
            detail={celebration.levelUp ? `${subject.name} level ${celebration.levelUp.level.level}` : celebration.newBadges[0]!.description}
            emoji={celebration.levelUp ? '🎉' : celebration.newBadges[0]!.emoji}
            onDone={() => setCelebration(null)}
          />
        )}
        <Summary topicTitle={topic.title} questions={questions} state={state} backTo={backTo} onRetake={start} />
      </>
    )
  }

  const question = questions[state.index]!
  const answered = state.answers[question.id]
  const last = state.index === questions.length - 1

  const submit = (answer: Answer) => {
    const result = mark(question, answer)
    setState({ ...state, answers: { ...state.answers, [question.id]: { answer, result } } })
  }
  const next = () => {
    if (!last) {
      setState({ ...state, index: state.index + 1 })
      window.scrollTo({ top: 0 })
      return
    }
    const finishedAt = new Date().toISOString()
    const results = questions.map((q) => ({ q, r: state.answers[q.id]?.result ?? { correct: false, marksScored: 0, marksAvailable: q.marks } }))
    const extended = questions.filter((q) => q.type === 'extended').length
    const before = getState()
    const previous = before.attempts.filter((a) => a.topicId === topic.id && a.kind === 'quiz').sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0]
    const previousPct = previous ? Math.round((100 * previous.marksScored) / previous.marksAvailable) : undefined
    const questionResults = results.map(({ q, r }) => ({ id: q.id, skill: q.skill, gradeBand: q.gradeBand, marksScored: r.marksScored, marksAvailable: r.marksAvailable, correct: r.correct }))
    const xp = xpForQuestions(questionResults)
    recordAttempt({
      id: state.attemptId,
      topicId: topic.id,
      kind: 'quiz',
      marksScored: results.reduce((s, x) => s + x.r.marksScored, 0),
      marksAvailable: results.reduce((s, x) => s + x.r.marksAvailable, 0),
      grade89Scored: results.filter((x) => x.q.gradeBand === '8-9').reduce((s, x) => s + x.r.marksScored, 0),
      grade89Available: results.filter((x) => x.q.gradeBand === '8-9').reduce((s, x) => s + x.r.marksAvailable, 0),
      markedHow: extended === 0 ? 'auto' : extended === questions.length ? 'self' : 'mixed',
      completedAt: finishedAt,
      xp,
      questions: questionResults,
    })
    const outcome = settle(before)
    if (outcome.newBadges.length || outcome.levelUp) setCelebration(outcome)
    setState({ ...state, finishedAt, earned: { xp, previousPct, badges: outcome.newBadges.map((b) => b.name), levelUp: outcome.levelUp ? `${outcome.levelUp.level.name}` : undefined } })
  }

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link to={backTo} aria-label="Leave quiz" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-rule bg-surface">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
        </Link>
        <div className="flex flex-grow flex-col gap-1.5">
          <div className="flex justify-between text-xs text-ink-2">
            <span className="font-bold uppercase tracking-[0.06em] text-[color:var(--subject)]">{subject.name} · {topic.title} · Quiz</span>
            <span>Question {state.index + 1} of {questions.length}</span>
          </div>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${questions.length}, minmax(0, 1fr))` }} role="progressbar" aria-valuemin={1} aria-valuemax={questions.length} aria-valuenow={state.index + 1}>
            {questions.map((q, i) => {
              const a = state.answers[q.id]
              const colour = a ? (a.result.correct ? 'var(--color-status-secure)' : a.result.marksScored > 0 ? 'var(--color-status-developing)' : 'var(--color-status-not-secure)') : i === state.index ? 'var(--subject)' : 'var(--color-rule)'
              return <span key={q.id} className="h-1.5 rounded-full" style={{ background: colour }} />
            })}
          </div>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-xs text-ink-2">
          <span className="rounded bg-panel px-2 py-0.5 font-bold">Grade {question.gradeBand}</span>
          <span>{question.marks} mark{question.marks > 1 ? 's' : ''}{question.calculator === 'non-calculator' ? ' · non-calculator' : question.calculator === 'calculator' ? ' · calculator' : ''}</span>
        </div>
        {question.visual && <Visual visual={question.visual} />}
        <RichText source={question.prompt} className="text-[17px] leading-relaxed" />
        <QuestionInput key={question.id} question={question} disabled={Boolean(answered)} onSubmit={submit} />
        {answered && <Feedback question={question} result={answered.result} />}
      </section>

      {answered && (
        <button type="button" onClick={next} className="h-12 rounded-xl bg-ink px-4 text-base font-bold text-surface">
          {last ? 'See your score' : 'Next question'}
        </button>
      )}
    </article>
  )
}

function Intro({ subjectName, title, count, pool, minutes, onStart, backTo }: { subjectName: string; title: string; count: number; pool: number; minutes: number; onStart: () => void; backTo: string }) {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--subject)]">{subjectName} · Quiz</p>
      <h1 className="text-3xl font-bold leading-tight">{title}</h1>
      <ul className="flex flex-col gap-1 text-ink-2">
        <li>{count} questions drawn from a pool of {pool}, so a retake is different.</li>
        <li>Each is marked as soon as you answer, with the worked solution.</li>
        <li>About {minutes} minutes. Your answers are kept if the page reloads.</li>
        <li>The point is to find out what has clicked and what has not. Wrong answers come with the full solution.</li>
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={onStart} className="h-12 rounded-xl bg-[color:var(--subject)] px-5 font-bold text-white">Start quiz</button>
        <Link to={backTo} className="flex h-12 items-center justify-center rounded-xl border border-rule bg-surface px-5 font-bold">Back to topic</Link>
      </div>
    </article>
  )
}

function Summary({ topicTitle, questions, state, backTo, onRetake }: { topicTitle: string; questions: Question[]; state: QuizState; backTo: string; onRetake: () => void }) {
  const scored = questions.reduce((s, q) => s + (state.answers[q.id]?.result.marksScored ?? 0), 0)
  const available = questions.reduce((s, q) => s + q.marks, 0)
  const pct = available ? Math.round((100 * scored) / available) : 0
  const seconds = Math.max(0, Math.round((new Date(state.finishedAt!).getTime() - new Date(state.startedAt).getTime()) / 1000))
  const missed = questions.filter((q) => !state.answers[q.id]?.result.correct)
  const tone = pct >= 90 ? 'var(--color-status-grade-9)' : pct >= 80 ? 'var(--color-status-secure)' : pct >= 50 ? 'var(--color-status-developing)' : 'var(--color-status-not-secure)'
  const earned = state.earned
  const previous = earned?.previousPct
  const delta = previous === undefined ? undefined : pct - previous
  const message = messageForScore(pct, previous, state.attemptId.charCodeAt(0) + state.attemptId.charCodeAt(1))
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--subject)]">Quiz finished</p>
        <h1 className="text-3xl font-bold leading-tight">{topicTitle}</h1>
      </header>
      <section className="grid grid-cols-3 gap-2">
        <Stat label="Score" value={`${pct}%`} colour={tone} />
        <Stat label="Marks" value={`${scored} / ${available}`} />
        <Stat label="Time" value={`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`} />
      </section>
      <section className="anim-pop flex flex-col gap-2 rounded-2xl border border-rule bg-surface p-4">
        <p className="flex items-center gap-2 text-lg font-bold"><Smiley bounce className="text-3xl">{emojiForScore(pct, previous)}</Smiley>{message}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
          {previous !== undefined && <span>Previous score: <strong className="text-ink">{previous}%</strong></span>}
          <span>{previous !== undefined ? 'Current' : 'Score'}: <strong className="text-ink">{pct}%</strong></span>
          {delta !== undefined && <span>Improvement: <strong style={{ color: delta >= 0 ? 'var(--color-status-secure)' : 'var(--color-status-not-secure)' }}>{delta >= 0 ? '+' : ''}{delta}%</strong></span>}
          {earned && <span className="relative">XP earned: <strong className="text-ink">+{earned.xp}</strong><span aria-hidden className="anim-float absolute -top-5 left-1/2 font-bold text-status-secure">+{earned.xp}</span></span>}
        </div>
        {earned && earned.badges.length > 0 && <p className="text-sm">New badge{earned.badges.length > 1 ? 's' : ''}: <strong>{earned.badges.join(', ')}</strong></p>}
        {earned?.levelUp && <p className="text-sm">Level up: <strong>{earned.levelUp}</strong></p>}
      </section>
      <p className="text-ink-2">
        {pct >= 90 ? 'You understand this topic well. The Advanced worksheet is where you find out how far the idea stretches.' : pct >= 80 ? 'Most of this makes sense to you. The Higher worksheet will make it stick.' : pct >= 50 ? 'You are part of the way there. The questions below show exactly what to look at again.' : 'This topic has not clicked yet, and that is normal. The lesson explains it one idea at a time.'}
      </p>
      {(() => {
        const got = [...new Set(questions.filter((q) => state.answers[q.id]?.result.correct).map((q) => q.skill))]
        return got.length > 0 ? (
          <section className="flex flex-col gap-2">
            <SectionLabel colour="#2e8b57" emoji="✅">You can now</SectionLabel>
            <ul className="flex flex-wrap gap-2">{got.map((s) => <li key={s} className="rounded-full border border-rule bg-surface px-3 py-1 text-sm">{s}</li>)}</ul>
          </section>
        ) : null
      })()}
      {missed.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel colour="#d25b3b" emoji="🔁">To learn from</SectionLabel>
          <ul className="flex flex-col gap-2">
            {missed.map((q) => {
              const r = state.answers[q.id]?.result
              return (
                <li key={q.id} className="flex flex-col gap-1 rounded-xl border border-rule bg-surface px-4 py-3">
                  <RichText source={q.prompt} className="text-sm" />
                  <div className="flex items-center justify-between text-xs text-ink-2">
                    <span>{r ? `${r.marksScored} of ${r.marksAvailable}` : 'not answered'} · grade {q.gradeBand} · {q.skill}</span>
                    <Link to={`${backTo}/lesson`} className="font-bold underline">Lesson</Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={onRetake} className="h-12 rounded-xl bg-[color:var(--subject)] px-5 font-bold text-white">Retake with new questions</button>
        <Link to={backTo} className="flex h-12 items-center justify-center rounded-xl border border-rule bg-surface px-5 font-bold">Back to topic</Link>
      </div>
    </article>
  )
}

function Stat({ label, value, colour }: { label: string; value: string; colour?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-panel px-3 py-3">
      <span className="text-[11px] text-ink-2">{label}</span>
      <span className="text-xl font-bold tabular-nums" style={colour ? { color: colour } : undefined}>{value}</span>
    </div>
  )
}
