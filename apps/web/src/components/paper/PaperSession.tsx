import { claimAnswer, describeAnswer, mark, type Generated, type MarkResult, type Question } from '@study/shared'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { RichText } from '../RichText.tsx'
import { Visual } from '../Visual.tsx'
import { Feedback } from '../questions/Feedback.tsx'
import { QuestionInput, type Answer } from '../questions/QuestionInput.tsx'
import { ReportMistake } from '../ReportMistake.tsx'
import { summaryById } from '../../content/index.ts'
import { minutesFor } from '../../content/paper.ts'
import { loadInProgress, saveInProgress } from '../../progress/inProgress.ts'
import { itemKey, type SessionAnswers, type SessionItem } from '../../progress/reviewSession.ts'
import type { StudyKind } from '../../progress/store.ts'
import { useActivityTimer } from '../../progress/useActivityTimer.ts'

export interface PaperQuestion { item: SessionItem; question: Question; generated?: Generated }

/**
 * A paper in progress, kept on the device (UXI-2) so closing the app does not lose it. Times
 * are clock times, so a timed paper's clock keeps running while the app is shut, as an exam's
 * would.
 */
export interface PaperState {
  /** The paper's own link: an unfinished paper only comes back for the same paper. */
  path: string
  id: string
  index: number
  answers: Record<string, { answer: Answer; result: MarkResult }>
  /** Extended answers as typed so far, and the ones written on paper instead. */
  texts: Record<string, string>
  onPaper: Record<string, boolean>
  /** Milliseconds spent on each question, and since when the one on screen has been showing. */
  spent: Record<string, number>
  viewSince: number
  startedAt: number
  /** Set on a timed paper. */
  allowedMs?: number
  handedIn?: number
  timeUp?: boolean
  /** The criteria the student ticks for each extended answer, after handing in. */
  ticks: Record<string, boolean[]>
  /** Method marks the student awards a wrong typed answer from its working, as on a worksheet. */
  method?: Record<string, number>
  /** Set once the marks are recorded, so the result outlives a reload. */
  finishedAt?: string
}

export interface PaperRecord {
  id: string
  answers: SessionAnswers
  finishedAt: string
  timed?: { allowedSeconds: number; usedSeconds: number }
}

const BUTTON = 'flex min-h-12 items-center justify-center rounded-xl px-5 font-bold'
/** Under this, a written answer reads as not attempted, as in the worksheet. */
const MIN_WRITTEN = 40

const minSec = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const minutesText = (ms: number) => {
  const m = Math.round(ms / 60000)
  return `${m} ${m === 1 ? 'minute' : 'minutes'}`
}

/** The time on screen added to the question being left. */
function leave(s: PaperState, questions: PaperQuestion[], now: number): PaperState {
  const at = questions[s.index]
  if (!at) return { ...s, viewSince: now }
  const k = itemKey(at.item)
  return { ...s, spent: { ...s.spent, [k]: (s.spent[k] ?? 0) + Math.max(0, now - s.viewSince) }, viewSince: now }
}

/** Marks an extended answer from the ticked criteria, never above the question's marks. */
function selfMark(q: Question, ticks: boolean[] | undefined): MarkResult {
  const got = q.type === 'extended' ? Math.min(q.marks, q.criteria.reduce((s, c, i) => s + (ticks?.[i] ? c.marks : 0), 0)) : 0
  return { correct: got === q.marks, marksScored: got, marksAvailable: q.marks }
}

/** Every answer as it is recorded: the marker's result, or the student's own for written answers. */
export function paperAnswers(s: PaperState, questions: PaperQuestion[]): SessionAnswers {
  const out: SessionAnswers = {}
  for (const pq of questions) {
    const k = itemKey(pq.item)
    if (pq.question.type === 'extended') {
      const result = selfMark(pq.question, s.ticks[k])
      out[k] = { answer: result.marksScored, result, self: true }
    } else if (s.answers[k]) {
      const a = s.answers[k]!
      const m = s.method?.[k]
      // Method marks only add to what the marker gave, and never make a wrong answer whole.
      out[k] = m !== undefined && !a.result.correct && m > a.result.marksScored
        ? { ...a, result: { ...a.result, marksScored: Math.min(m, methodTotal(pq.question)) }, methodMarked: true }
        : a
    }
  }
  return out
}

/**
 * The method marks a question offers: its mark scheme's lines other than accuracy, capped one
 * below full marks, so a wrong final answer can never be self-awarded every mark. The same rule
 * as the worksheet's.
 */
export function methodTotal(q: Question): number {
  return Math.max(0, Math.min(q.markScheme.filter((l) => !/^A\d/.test(l.code)).reduce((n, l) => n + l.marks, 0), q.marks - 1))
}

/** Whether question `k` has an answer in: typed or chosen, or written (or written on paper). */
function answered(s: PaperState, pq: PaperQuestion): boolean {
  const k = itemKey(pq.item)
  if (pq.question.type === 'extended') return (s.texts[k]?.trim().length ?? 0) >= MIN_WRITTEN || Boolean(s.onPaper[k])
  return Boolean(s.answers[k])
}

/**
 * An exam-style paper (TOP-3, WKP-4, WKP-5): every question in, moving freely between them,
 * and nothing marked or explained until it is handed in; then the mark, each question's
 * solution and the time spent on it. Timed, it gives the subject's own exam pace and hands in
 * by itself when the time is up. What the questions are, and where the result is recorded,
 * belong to the caller.
 */
export function PaperSession({ storageKey, path, subjectId, kicker, title, intro, questions, perMark, studyKind, record, after, showTopic = true }: {
  storageKey: string
  path: string
  subjectId: string
  kicker: string
  title: string
  intro: string[]
  questions: PaperQuestion[]
  perMark: number
  studyKind: StudyKind
  record: (r: PaperRecord) => void
  after: ReactNode
  showTopic?: boolean
}) {
  const [state, setStateRaw] = useState<PaperState | null>(() => {
    const s = loadInProgress<PaperState>(storageKey)
    return s && s.path === path ? s : null
  })
  const setState = (s: PaperState | null) => { saveInProgress(storageKey, s); setStateRaw(s) }
  const marks = questions.reduce((s, q) => s + q.question.marks, 0)
  const allowedMinutes = minutesFor(marks, perMark)
  const live = state && !state.handedIn ? state : null
  const current = live ? questions[live.index] : undefined
  useActivityTimer(current ? { subjectId, topicId: current.item.topicId, kind: studyKind } : undefined, Boolean(live))

  // The clock: redrawn each second while a timed paper is open, and handing in at nought.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!live?.allowedMs) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [live?.allowedMs])
  const handIn = (s: PaperState, timeUp = false) => {
    const at = Date.now()
    const done: PaperState = { ...leave(s, questions, at), handedIn: at, ...(timeUp ? { timeUp: true } : {}) }
    const finishedAt = new Date(at).toISOString()
    record({ id: done.id, answers: paperAnswers(done, questions), finishedAt, ...(timing(done)) })
    setState({ ...done, finishedAt })
    window.scrollTo({ top: 0 })
  }
  const remaining = live?.allowedMs ? live.startedAt + live.allowedMs - now : undefined
  const handedInByClock = useRef(false)
  useEffect(() => {
    if (live && remaining !== undefined && remaining <= 0 && !handedInByClock.current) {
      handedInByClock.current = true
      handIn(live, true)
    }
  })

  if (!state) {
    const start = (timed: boolean) => {
      const t = Date.now()
      handedInByClock.current = false
      setState({ path, id: crypto.randomUUID(), index: 0, answers: {}, texts: {}, onPaper: {}, spent: {}, viewSince: t, startedAt: t, ticks: {}, ...(timed ? { allowedMs: allowedMinutes * 60000 } : {}) })
    }
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <p className="text-xs font-bold uppercase tracking-[0.08em] accent-ink">{kicker}</p>
        <h1 className="text-3xl font-bold leading-tight">{title}</h1>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-ink-2">
          <li>{questions.length} questions, {marks} marks.</li>
          {intro.map((line) => <li key={line}>{line}</li>)}
          <li>Nothing is marked until you hand it in: move between the questions as you like, and change an answer before then.</li>
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={() => start(true)} className={`${BUTTON} bg-[color:var(--subject)] text-white`}>Start, timed: {allowedMinutes} minutes</button>
          <button type="button" onClick={() => start(false)} className={`${BUTTON} border border-rule bg-surface`}>Start without the clock</button>
        </div>
        <p className="text-sm text-ink-2">The time is the exam’s own pace for this subject, about {perMark.toFixed(1).replace(/\.0$/, '')} {perMark === 1 ? 'minute' : 'minutes'} a mark. When it runs out the paper is handed in as it stands.</p>
      </article>
    )
  }

  if (state.handedIn) return <PaperResult state={state} questions={questions} kicker={kicker} title={title} subjectId={subjectId} showTopic={showTopic} after={after}
    onChange={(next) => { setState(next); record({ id: next.id, answers: paperAnswers(next, questions), finishedAt: next.finishedAt ?? new Date().toISOString(), ...timing(next) }) }}
    onRestart={() => setState(null)} />

  const s = state
  const at = questions[s.index]
  if (!at) {
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <p className="text-ink-2">This paper has changed since it was started.</p>
        <button type="button" onClick={() => setState(null)} className={`${BUTTON} w-fit bg-ink text-surface`}>Start again</button>
      </article>
    )
  }
  const k = itemKey(at.item)
  const go = (i: number) => { setState({ ...leave(s, questions, Date.now()), index: i }); window.scrollTo({ top: 0 }) }
  const left = questions.filter((pq) => !answered(s, pq)).length
  const last = s.index === questions.length - 1

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 border-b border-rule bg-paper/95 px-4 py-2 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-bold uppercase tracking-[0.08em] text-ink-2">Question {s.index + 1} of {questions.length}</span>
          {remaining !== undefined ? (
            <span role="timer" aria-label={`${minutesText(remaining)} left`} className={`rounded-lg px-2.5 py-1 font-mono text-base font-bold tabular-nums ${remaining < 5 * 60000 ? 'bg-status-not-secure text-white' : 'bg-panel'}`}>{minSec(remaining)}</span>
          ) : (
            <span className="text-ink-2">No clock</span>
          )}
        </div>
        <nav aria-label="Questions" className="flex flex-wrap gap-1">
          {questions.map((pq, i) => {
            const done = answered(s, pq)
            return (
              <button key={itemKey(pq.item)} type="button" onClick={() => go(i)} aria-current={i === s.index ? 'step' : undefined} aria-label={`Question ${i + 1}${done ? ', answered' : ''}`}
                className={`h-8 min-w-8 rounded-md px-1 text-xs font-bold tabular-nums ${i === s.index ? 'ring-2 ring-[color:var(--subject)] ring-offset-1' : ''} ${done ? 'bg-[color:var(--subject)] text-white' : 'border border-rule bg-surface'}`}>
                {i + 1}
              </button>
            )
          })}
        </nav>
      </header>

      <section className="flex flex-col gap-4">
        <p className="text-right text-xs text-ink-2">{at.question.marks} mark{at.question.marks > 1 ? 's' : ''}</p>
        {at.question.visual && <Visual visual={at.question.visual} />}
        <RichText source={at.question.prompt} className="text-[17px] leading-relaxed" />
        {at.question.type === 'extended' ? (
          <div className="flex flex-col gap-2">
            <textarea value={s.texts[k] ?? ''} onChange={(e) => setState({ ...s, texts: { ...s.texts, [k]: e.target.value } })} rows={8} aria-label="Your answer"
              placeholder={`Write your answer. About ${at.question.suggestedMinutes} minutes.`}
              className="w-full rounded-lg border border-rule bg-surface p-3 text-[15px] focus:border-[color:var(--subject)]" />
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" checked={Boolean(s.onPaper[k])} onChange={(e) => setState({ ...s, onPaper: { ...s.onPaper, [k]: e.target.checked } })} className="h-5 w-5" />
              I wrote this one on paper
            </label>
            <p className="text-xs text-ink-2">Written answers are marked by you, against the mark scheme, once the paper is handed in.</p>
          </div>
        ) : s.answers[k] ? (
          <div className="flex flex-col gap-2 rounded-xl border border-rule bg-surface p-4">
            <p className="text-sm"><span className="font-bold">Your answer:</span> <RichText source={describeAnswer(at.question, s.answers[k]!.answer) ?? '—'} inline /></p>
            <button type="button" onClick={() => { const { [k]: _gone, ...rest } = s.answers; setState({ ...s, answers: rest }) }} className="min-h-10 w-fit rounded-lg border border-rule px-3 text-sm font-bold">Change answer</button>
          </div>
        ) : (
          <QuestionInput key={`${k}:${Object.keys(s.answers).length}`} subjectId={subjectId} question={at.question} submitLabel="Save answer" onSubmit={(answer) => {
            const next = { ...s, answers: { ...s.answers, [k]: { answer, result: mark(at.question, answer) } } }
            setState(last ? next : { ...leave(next, questions, Date.now()), index: s.index + 1 })
            if (!last) window.scrollTo({ top: 0 })
          }} />
        )}
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <div className="flex gap-2">
          <button type="button" disabled={s.index === 0} onClick={() => go(s.index - 1)} className={`${BUTTON} flex-1 border border-rule bg-surface disabled:opacity-40`}>Previous</button>
          <button type="button" disabled={last} onClick={() => go(s.index + 1)} className={`${BUTTON} flex-1 border border-rule bg-surface disabled:opacity-40`}>Next</button>
        </div>
        <HandIn left={left} onHandIn={() => handIn(s)} />
      </div>
    </article>
  )
}

function timing(s: PaperState): Pick<PaperRecord, 'timed'> {
  if (!s.allowedMs || !s.handedIn) return {}
  return { timed: { allowedSeconds: Math.round(s.allowedMs / 1000), usedSeconds: Math.round(Math.min(s.allowedMs, s.handedIn - s.startedAt) / 1000) } }
}

/** Hand in, with a second press when questions are still unanswered. */
function HandIn({ left, onHandIn }: { left: number; onHandIn: () => void }) {
  const [sure, setSure] = useState(false)
  if (left > 0 && !sure) return <button type="button" onClick={() => setSure(true)} className={`${BUTTON} bg-ink text-surface`}>Hand in</button>
  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      {left > 0 && <p className="text-sm font-bold">{left} {left === 1 ? 'question has' : 'questions have'} no answer yet and will score nothing.</p>}
      <button type="button" onClick={onHandIn} className={`${BUTTON} bg-ink text-surface`}>{left > 0 ? 'Hand in anyway' : 'Hand in'}</button>
    </div>
  )
}

/** After handing in: the mark, time, marks by topic, and every question opened up. */
function PaperResult({ state: s, questions, kicker, title, subjectId, showTopic, after, onChange, onRestart }: {
  state: PaperState
  questions: PaperQuestion[]
  kicker: string
  title: string
  subjectId: string
  showTopic: boolean
  after: ReactNode
  onChange: (s: PaperState) => void
  onRestart: () => void
}) {
  const answers = paperAnswers(s, questions)
  const got = questions.reduce((n, pq) => n + (answers[itemKey(pq.item)]?.result.marksScored ?? 0), 0)
  const marks = questions.reduce((n, pq) => n + pq.question.marks, 0)
  const used = (s.handedIn ?? Date.now()) - s.startedAt
  const written = questions.filter((pq) => pq.question.type === 'extended')
  const topics = [...new Set(questions.map((pq) => pq.item.topicId))]
  const byTopic = topics.map((topicId) => {
    const qs = questions.filter((pq) => pq.item.topicId === topicId)
    return { topicId, title: summaryById(topicId)?.title ?? topicId, got: qs.reduce((n, pq) => n + (answers[itemKey(pq.item)]?.result.marksScored ?? 0), 0), of: qs.reduce((n, pq) => n + pq.question.marks, 0) }
  })
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <p className="text-xs font-bold uppercase tracking-[0.08em] accent-ink">{kicker} · handed in</p>
      <h1 className="text-3xl font-bold leading-tight">{got} of {marks} marks <span className="text-ink-2">({Math.round((100 * got) / Math.max(1, marks))}%)</span></h1>
      <p className="text-ink-2">
        {title}. {s.timeUp ? `Time ran out at ${minutesText(s.allowedMs ?? used)}.` : s.allowedMs ? `Handed in after ${minutesText(used)} of ${minutesText(s.allowedMs)}.` : `Took ${minutesText(used)}, without the clock.`}
        {written.length > 0 && ` ${written.length === 1 ? 'One written answer is' : `${written.length} written answers are`} marked by you below: until you tick the criteria, it scores nothing.`}
      </p>
      {showTopic && byTopic.length > 1 && (
        <ul className="flex flex-col gap-2">
          {byTopic.map((t) => (
            <li key={t.topicId} className="flex items-center justify-between gap-3 rounded-xl border border-rule bg-surface px-4 py-3 text-sm">
              <Link to={`/subjects/${subjectId}/topics/${t.topicId}`} className="min-w-0 font-bold underline">{t.title}</Link>
              <span className="shrink-0 font-bold tabular-nums">{t.got} / {t.of}</span>
            </li>
          ))}
        </ul>
      )}
      <section className="flex flex-col gap-2" aria-label="Each question">
        <h2 className="font-bold">Each question</h2>
        {questions.map((pq, i) => {
          const k = itemKey(pq.item)
          const a = answers[k]
          const q = pq.question
          const open = q.type === 'extended' || !a?.result.correct
          return (
            <details key={k} open={open} className="rounded-xl border border-rule bg-surface">
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="min-w-0"><strong>Q{i + 1}</strong>{showTopic && <span className="text-ink-2"> · {summaryById(pq.item.topicId)?.title}</span>}</span>
                <span className="flex shrink-0 gap-3 tabular-nums"><span className="font-bold">{a?.result.marksScored ?? 0} / {q.marks}</span><span className="text-ink-2" title="Time spent">{minSec(s.spent[k] ?? 0)}</span></span>
              </summary>
              <div className="flex flex-col gap-3 border-t border-rule p-4">
                {q.visual && <Visual visual={q.visual} />}
                <RichText source={q.prompt} className="text-[15px] leading-relaxed" />
                {q.type === 'extended' ? (
                  <WrittenMarking question={q} text={s.texts[k]} onPaper={Boolean(s.onPaper[k])} ticks={s.ticks[k]} onTicks={(t) => onChange({ ...s, ticks: { ...s.ticks, [k]: t } })} />
                ) : (
                  <>
                    <p className="text-sm"><span className="font-bold">Your answer:</span> {s.answers[k] ? <RichText source={describeAnswer(q, s.answers[k]!.answer) ?? '—'} inline /> : 'none given'}</p>
                    <Feedback question={q} result={s.answers[k]?.result ?? { correct: false, marksScored: 0, marksAvailable: q.marks }}
                      onClaim={s.answers[k] ? () => onChange({ ...s, answers: { ...s.answers, [k]: { ...s.answers[k]!, result: claimAnswer(s.answers[k]!.result) } } }) : undefined} />
                    {s.answers[k] && !s.answers[k]!.result.correct && methodTotal(q) > 0 && (
                      <MethodMarks most={methodTotal(q)} given={s.method?.[k]} onGive={(n) => onChange({ ...s, method: { ...s.method, [k]: n } })} />
                    )}
                  </>
                )}
                <ReportMistake item={{ subjectId, topicId: pq.item.topicId, itemKind: 'question', itemId: q.id, seenIn: 'worksheet', ...(pq.generated ? { generated: { generatorId: pq.generated.generatorId, seed: pq.generated.seed } } : {}) }} />
              </div>
            </details>
          )
        })}
      </section>
      <p className="text-ink-2">Wrong answers wait in Redo my mistakes. A topic where marks went is the one to go back to: its lesson and worksheets are a tap away.</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {after}
        <button type="button" onClick={onRestart} className={`${BUTTON} border border-rule bg-surface`}>Sit it again</button>
      </div>
    </article>
  )
}

/** The method marks a wrong answer's working earned, chosen by the student against the scheme. */
function MethodMarks({ most, given, onGive }: { most: number; given?: number; onGive: (n: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-bold">Method marks your working earned, by the mark scheme in the solution:</p>
      <div role="radiogroup" aria-label="Method marks" className="flex flex-wrap gap-1.5">
        {Array.from({ length: most + 1 }, (_, n) => (
          <button key={n} type="button" role="radio" aria-checked={(given ?? 0) === n} onClick={() => onGive(n)}
            className={`h-10 min-w-10 rounded-lg px-3 text-sm font-bold ${(given ?? 0) === n ? 'bg-ink text-surface' : 'border border-rule bg-surface'}`}>{n}</button>
        ))}
      </div>
    </div>
  )
}

/** A written answer beside its model answer, with the criteria to tick. */
function WrittenMarking({ question, text, onPaper, ticks, onTicks }: { question: Extract<Question, { type: 'extended' }>; text?: string; onPaper: boolean; ticks?: boolean[]; onTicks: (t: boolean[]) => void }) {
  const on = ticks ?? question.criteria.map(() => false)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Your answer</p>
        {text?.trim() ? <p className="whitespace-pre-wrap rounded-lg border border-rule p-3 text-sm">{text}</p>
          : <p className="rounded-lg border border-dashed border-rule p-3 text-sm text-ink-2">{onPaper ? 'Written on paper. Have it beside you as you tick.' : 'Nothing written.'}</p>}
      </div>
      <div className="flex flex-col gap-1.5 rounded-xl border border-rule p-3">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Model answer, full marks</p>
        <RichText source={question.modelAnswer} className="text-sm" />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Tick what your answer includes</legend>
        {question.criteria.map((c, i) => (
          <label key={i} className="flex min-h-11 cursor-pointer items-start gap-3">
            <input type="checkbox" checked={Boolean(on[i])} onChange={(e) => onTicks(on.map((v, j) => (j === i ? e.target.checked : v)))} className="mt-1 h-5 w-5" />
            <span className="flex-grow text-sm"><RichText source={c.text} inline /></span>
            <span className="text-xs text-ink-2">{c.marks} mark{c.marks > 1 ? 's' : ''}</span>
          </label>
        ))}
      </fieldset>
    </div>
  )
}
