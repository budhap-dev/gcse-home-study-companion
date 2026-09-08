import { getSubject, mark, type MarkResult, type Question, type WorksheetLevel } from '@study/shared'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { RichText } from '../../components/RichText.tsx'
import { ScratchCanvas, type Stroke } from '../../components/ScratchCanvas.tsx'
import { Visual } from '../../components/Visual.tsx'
import { Feedback } from '../../components/questions/Feedback.tsx'
import { QuestionInput, type Answer } from '../../components/questions/QuestionInput.tsx'
import { getTopic, totalMarks } from '../../content/index.ts'
import { getState, recordAttempt } from '../../progress/store.ts'
import { settle } from '../../progress/settle.ts'
import { xpForQuestions } from '../../progress/xp.ts'
import { useActivityTimer } from '../../progress/useActivityTimer.ts'

const LEVEL_LABEL: Record<WorksheetLevel, string> = { core: 'Core', higher: 'Higher', advanced: 'Advanced' }
const LEVEL_NOTE: Record<WorksheetLevel, string> = {
  core: 'Prerequisites only. Short, done once.',
  higher: 'Grade 6 to 8 exam-style questions. 70% here, with a quiz at 80%, makes the topic Secure.',
  advanced: 'Grade 9 questions: multi-step, unfamiliar contexts, show that, explain. 75% here, with a quiz at 90%, makes the topic Grade 9 ready.',
}

interface Answered {
  answer: Answer
  result: MarkResult
  /** Method marks the student awards themselves after revealing the solution, for typed-answer questions. */
  methodMarks?: number
}

interface SheetState {
  attemptId: string
  index: number
  answers: Record<string, Answered>
  revealed: Record<string, boolean>
  canvases: Record<string, Stroke[]>
  startedAt: string
  finishedAt?: string
}

const key = (topicId: string, level: string) => `study-companion.worksheet.${topicId}.${level}`
function load(topicId: string, level: string): SheetState | null {
  try {
    const raw = sessionStorage.getItem(key(topicId, level))
    return raw ? (JSON.parse(raw) as SheetState) : null
  } catch {
    return null
  }
}
function save(topicId: string, level: string, state: SheetState | null) {
  try {
    if (state) sessionStorage.setItem(key(topicId, level), JSON.stringify(state))
    else sessionStorage.removeItem(key(topicId, level))
  } catch {
    // no session storage: the sheet still works for this visit
  }
}

/**
 * A worksheet at one level. Question, scratch canvas, and worked solution live side
 * by side on wide screens and stack on a phone. Final answers auto-mark; after the
 * solution is revealed the student awards their own method marks against the scheme.
 */
export function Worksheet() {
  const { subjectId, topicId, level: levelParam } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  const topic = subjectId && topicId ? getTopic(subjectId, topicId) : undefined
  const level = (['core', 'higher', 'advanced'] as const).find((l) => l === levelParam)
  const [state, setState] = useState<SheetState | null>(() => (topic && level ? load(topic.id, level) : null))
  useActivityTimer(Boolean(state && !state.finishedAt))

  useEffect(() => {
    if (topic && level) save(topic.id, level, state)
  }, [topic, level, state])

  const questions = useMemo(() => {
    if (!topic || !level) return []
    const byId = new Map(topic.questions.map((q) => [q.id, q]))
    return topic.worksheets[level].questionIds.map((id) => byId.get(id)).filter((q): q is Question => Boolean(q))
  }, [topic, level])

  if (!subject || !topic || !level) return <p>Unknown worksheet.</p>
  const sheet = topic.worksheets[level]
  const backTo = `/subjects/${subject.id}/topics/${topic.id}`
  const marksAvailable = totalMarks(topic, sheet.questionIds)
  const start = () => setState({ attemptId: crypto.randomUUID(), index: 0, answers: {}, revealed: {}, canvases: {}, startedAt: new Date().toISOString() })

  if (!state) {
    return (
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--subject)]">{subject.name} · {topic.title}</p>
        <h1 className="text-3xl font-bold leading-tight">{LEVEL_LABEL[level]} worksheet</h1>
        <ul className="flex flex-col gap-1 text-ink-2">
          <li>{questions.length} questions · {marksAvailable} marks · about {sheet.suggestedMinutes} minutes.</li>
          <li>{LEVEL_NOTE[level]}</li>
          <li>Write your working on the canvas, type the final answer, then reveal the solution and award your method marks.</li>
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={start} className="h-12 rounded-xl bg-[color:var(--subject)] px-5 font-bold text-white">Start worksheet</button>
          <Link to={backTo} className="flex h-12 items-center justify-center rounded-xl border border-rule bg-surface px-5 font-bold">Back to topic</Link>
        </div>
      </article>
    )
  }

  const scored = (q: Question) => {
    const a = state.answers[q.id]
    if (!a) return 0
    return q.type === 'extended' ? a.result.marksScored : a.result.correct ? q.marks : (a.methodMarks ?? 0)
  }
  const totalScored = questions.reduce((s, q) => s + scored(q), 0)

  if (state.finishedAt) {
    const pct = marksAvailable ? Math.round((100 * totalScored) / marksAvailable) : 0
    const threshold = level === 'higher' ? 70 : level === 'advanced' ? 75 : undefined
    return (
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--subject)]">Worksheet finished</p>
          <h1 className="text-3xl font-bold leading-tight">{topic.title} · {LEVEL_LABEL[level]}</h1>
        </header>
        <section className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-0.5 rounded-xl bg-panel px-3 py-3"><span className="text-[11px] text-ink-2">Score</span><span className="text-xl font-bold tabular-nums">{pct}%</span></div>
          <div className="flex flex-col gap-0.5 rounded-xl bg-panel px-3 py-3"><span className="text-[11px] text-ink-2">Marks</span><span className="text-xl font-bold tabular-nums">{totalScored} / {marksAvailable}</span></div>
        </section>
        <p className="text-ink-2">
          {threshold === undefined ? 'Core done. The Higher worksheet is where the exam-style questions start.' : pct >= threshold ? `Above the ${threshold}% this level needs. Recorded as self-marked.` : `Below the ${threshold}% this level needs. Look at the questions you dropped marks on and try again.`}
        </p>
        <ul className="flex flex-col gap-2">
          {questions.map((q, i) => (
            <li key={q.id} className="flex items-center justify-between rounded-xl border border-rule bg-surface px-4 py-3 text-sm">
              <span>Q{i + 1} · grade {q.gradeBand} · {q.skill}</span>
              <span className="font-bold tabular-nums">{scored(q)} / {q.marks}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={start} className="h-12 rounded-xl bg-[color:var(--subject)] px-5 font-bold text-white">Do it again</button>
          <Link to={backTo} className="flex h-12 items-center justify-center rounded-xl border border-rule bg-surface px-5 font-bold">Back to topic</Link>
        </div>
      </article>
    )
  }

  const question = questions[state.index]!
  const answered = state.answers[question.id]
  const revealed = Boolean(state.revealed[question.id])
  const allAnswered = questions.every((q) => state.answers[q.id])
  const typed = question.type !== 'extended'
  const methodLines = question.markScheme.filter((l) => !/^A\d/.test(l.code))
  const methodTotal = methodLines.reduce((s, l) => s + l.marks, 0)

  const submit = (answer: Answer) => setState({ ...state, answers: { ...state.answers, [question.id]: { answer, result: mark(question, answer) } } })
  const reveal = () => setState({ ...state, revealed: { ...state.revealed, [question.id]: true } })
  const setMethod = (n: number) => answered && setState({ ...state, answers: { ...state.answers, [question.id]: { ...answered, methodMarks: n } } })
  const setStrokes = (strokes: Stroke[]) => setState({ ...state, canvases: { ...state.canvases, [question.id]: strokes } })
  const go = (i: number) => { setState({ ...state, index: i }); window.scrollTo({ top: 0 }) }
  const finish = () => {
    const finishedAt = new Date().toISOString()
    const before = getState()
    const questionResults = questions.map((q) => ({ id: q.id, skill: q.skill, gradeBand: q.gradeBand, marksScored: scored(q), marksAvailable: q.marks, correct: scored(q) === q.marks }))
    const extendedCount = questions.filter((q) => q.type === 'extended').length
    const selfMarked = questions.some((q) => (q.type === 'extended' ? true : state.answers[q.id]?.methodMarks !== undefined && !state.answers[q.id]?.result.correct))
    recordAttempt({
      id: state.attemptId,
      topicId: topic.id,
      kind: 'worksheet',
      level,
      marksScored: totalScored,
      marksAvailable,
      grade89Scored: questions.filter((q) => q.gradeBand === '8-9').reduce((s, q) => s + scored(q), 0),
      grade89Available: questions.filter((q) => q.gradeBand === '8-9').reduce((s, q) => s + q.marks, 0),
      markedHow: extendedCount === questions.length ? 'self' : selfMarked ? 'mixed' : 'auto',
      completedAt: finishedAt,
      xp: xpForQuestions(questionResults),
      questions: questionResults,
    })
    settle(before)
    setState({ ...state, finishedAt })
  }

  return (
    <article className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <Link to={backTo} aria-label="Leave worksheet" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-rule bg-surface">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
        </Link>
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-[0.06em] text-[color:var(--subject)]">{subject.name} · {LEVEL_LABEL[level]} worksheet</span>
          <span className="font-bold">{topic.title}</span>
        </div>
        <nav aria-label="Questions" className="ml-auto flex flex-wrap gap-1.5">
          {questions.map((q, i) => {
            const a = state.answers[q.id]
            const bg = i === state.index ? 'bg-ink text-surface' : a ? (a.result.correct ? 'bg-status-secure text-white' : scored(q) > 0 ? 'bg-status-developing text-white' : 'bg-status-not-secure text-white') : 'border border-rule bg-surface'
            return (
              <button key={q.id} type="button" onClick={() => go(i)} aria-current={i === state.index ? 'step' : undefined} className={`h-9 w-9 rounded-full text-xs font-bold ${bg}`}>{i + 1}</button>
            )
          })}
        </nav>
        <span className="text-sm text-ink-2 tabular-nums">{totalScored} / {marksAvailable} so far</span>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section className="flex flex-col gap-4 rounded-2xl border border-rule bg-surface p-4">
          <div className="flex items-center justify-between text-xs text-ink-2">
            <span className="font-bold">Question {state.index + 1}</span>
            <span>{question.marks} mark{question.marks > 1 ? 's' : ''} · grade {question.gradeBand}{question.calculator === 'non-calculator' ? ' · non-calculator' : question.calculator === 'calculator' ? ' · calculator' : ''}</span>
          </div>
          {question.visual && <Visual visual={question.visual} />}
          <RichText source={question.prompt} className="text-[17px] leading-relaxed" />
          <QuestionInput key={question.id} question={question} disabled={Boolean(answered)} onSubmit={submit} />
          {answered && typed && (
            <p className="text-sm font-bold" style={{ color: answered.result.correct ? 'var(--color-status-secure)' : 'var(--color-status-not-secure)' }}>
              {answered.result.correct ? `Final answer correct: ${question.marks} of ${question.marks}` : 'Final answer not matched. Reveal the solution and award your method marks.'}
            </p>
          )}
          {answered && typed && !revealed && (
            <button type="button" onClick={reveal} className="h-11 rounded-lg border border-rule bg-surface font-bold">Reveal worked solution</button>
          )}
          {answered && (revealed || !typed) && (
            <div className="flex flex-col gap-3">
              <Feedback question={question} result={answered.result} />
              {typed && !answered.result.correct && methodLines.length > 0 && (
                <div className="flex flex-col gap-2 rounded-xl bg-panel p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Method marks you earned</p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {question.markScheme.map((l) => (
                      <li key={l.code} className="flex gap-2"><span className="w-7 font-mono text-xs text-ink-3">{l.code}</span><RichText source={l.description} inline /></li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: methodTotal + 1 }, (_, n) => (
                      <button key={n} type="button" onClick={() => setMethod(n)} aria-pressed={answered.methodMarks === n} className={`h-10 min-w-10 rounded-lg px-3 text-sm font-bold ${answered.methodMarks === n ? 'bg-ink text-surface' : 'border border-rule bg-surface'}`}>{n}</button>
                    ))}
                    <span className="self-center text-xs text-ink-2">of {methodTotal} method mark{methodTotal > 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <ScratchCanvas strokes={state.canvases[question.id] ?? []} onChange={setStrokes} />
        </section>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <div className="flex gap-2">
          <button type="button" onClick={() => go(state.index - 1)} disabled={state.index === 0} className="h-12 rounded-xl border border-rule bg-surface px-4 font-bold disabled:opacity-40">Previous</button>
          <button type="button" onClick={() => go(state.index + 1)} disabled={state.index === questions.length - 1} className="h-12 rounded-xl border border-rule bg-surface px-4 font-bold disabled:opacity-40">Next</button>
        </div>
        <button type="button" onClick={finish} disabled={!allAnswered} className="h-12 rounded-xl bg-[color:var(--subject)] px-5 font-bold text-white disabled:opacity-40">
          {allAnswered ? 'Finish and record score' : `${questions.filter((q) => state.answers[q.id]).length} of ${questions.length} answered`}
        </button>
      </div>
    </article>
  )
}
