import { claimAnswer, getSubject, mark } from '@study/shared'
import { useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import type { Answer } from '../../components/questions/QuestionInput.tsx'
import { SessionQuestion } from '../../components/questions/SessionQuestion.tsx'
import { ShareSheet } from '../../components/ShareSheet.tsx'
import { TopicLoading } from '../../components/TopicLoading.tsx'
import { summaryById, topicsForSubject } from '../../content/index.ts'
import { useTopics } from '../../content/load.ts'
import { mixedPath, parseSpec, pickItems, sheetFor } from '../../content/mixedSheet.ts'
import { loadInProgress, saveInProgress } from '../../progress/inProgress.ts'
import { itemKey, recordReview, type SessionAnswers } from '../../progress/reviewSession.ts'
import { useActivityTimer } from '../../progress/useActivityTimer.ts'

const LEVEL = { core: 'Core', higher: 'Higher', advanced: 'Advanced' } as const
const BUTTON = 'flex h-12 items-center justify-center rounded-xl px-5 font-bold'

interface Session {
  /** The sheet's own link, so an unfinished session only comes back for the same sheet. */
  path: string
  id: string
  index: number
  answers: SessionAnswers
  finishedAt?: string
}

const key = (subjectId: string) => `study-companion.mixed.${subjectId}`

/**
 * A mixed worksheet on screen, one question at a time and marked as it goes, like the daily
 * recap. The topic is not named until the question is answered: deciding which method it
 * needs is the point. Recorded as a review per topic (results feed each question's own
 * topic) with the sheet's code, so the parent's breakdown shows the numbers the student had.
 */
export function MixedWorksheet() {
  const { subjectId = '' } = useParams()
  const [params] = useSearchParams()
  const { pathname, search } = useLocation()
  const path = `${pathname}${search}`
  const spec = parseSpec(subjectId, params)
  const subject = getSubject(subjectId)
  const items = spec ? pickItems(spec, topicsForSubject(subjectId)) : []
  const loaded = useTopics(items.map((m) => ({ subjectId, topicId: m.topicId })))
  const [session, setSessionState] = useState<Session | null>(() => {
    const s = loadInProgress<Session>(key(subjectId))
    return s && s.path === path ? s : null
  })
  const setSession = (s: Session | null) => { saveInProgress(key(subjectId), s); setSessionState(s) }
  const live = session && !session.finishedAt ? session : null
  const current = live ? items[live.index] : undefined
  useActivityTimer(current ? { subjectId, topicId: current.topicId, kind: 'worksheet' } : undefined, Boolean(live))

  if (!subject || !spec) {
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-bold">This worksheet link is not complete</h1>
        <p className="text-ink-2">It needs at least three topics, a level, a number of questions and a sheet code.</p>
        <Link to={subject ? `/subjects/${subjectId}/make-worksheet` : '/subjects'} className={`${BUTTON} w-fit bg-ink text-surface`}>Make a worksheet</Link>
      </article>
    )
  }
  if (!loaded) return <TopicLoading />
  const sheet = sheetFor(spec, items, loaded)
  const titles = [...new Set(items.map((m) => m.topicId))].map((id) => summaryById(id)?.title ?? id)
  const marksAvailable = sheet.reduce((s, q) => s + q.question.marks, 0)
  const printPath = mixedPath(spec, { codes: [spec.code] })
  const makePath = `/subjects/${subjectId}/make-worksheet`

  if (!session) {
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <p className="text-xs font-bold uppercase tracking-[0.08em] accent-ink">{subject.name} · Mixed worksheet · {LEVEL[spec.level]}</p>
        <h1 className="text-3xl font-bold leading-tight">{sheet.length} questions, mixed</h1>
        <ul className="flex flex-col gap-1 text-ink-2">
          <li>{marksAvailable} marks · sheet <strong className="font-mono text-ink">{spec.code}</strong></li>
          <li>From {titles.length} topics: {titles.join(', ')}.</li>
          <li>The topic of each question is shown only once it is answered: deciding which method it needs is part of the question.</li>
          <li>It earns XP and adds to each topic's history; it does not change a topic's status. Wrong answers wait in Redo my mistakes.</li>
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={() => setSession({ path, id: crypto.randomUUID(), index: 0, answers: {} })} className={`${BUTTON} bg-[color:var(--subject)] text-white`}>Start</button>
          <Link to={printPath} className={`${BUTTON} border border-rule bg-surface`}>Print or save as PDF</Link>
          <ShareSheet path={path} title={`${subject.name} · mixed worksheet ${spec.code}`} />
          <Link to={makePath} className={`${BUTTON} border border-rule bg-surface`}>Make a different one</Link>
        </div>
      </article>
    )
  }

  if (session.finishedAt) {
    const scored = (i: number) => session.answers[itemKey(items[i]!)]?.result
    const total = sheet.reduce((s, _, i) => s + (scored(i)?.marksScored ?? 0), 0)
    const byTopic = titles.map((title, k) => {
      const topicId = [...new Set(items.map((m) => m.topicId))][k]!
      const idx = items.flatMap((m, i) => (m.topicId === topicId ? [i] : []))
      return { topicId, title, got: idx.reduce((s, i) => s + (scored(i)?.marksScored ?? 0), 0), of: idx.reduce((s, i) => s + sheet[i]!.question.marks, 0) }
    })
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <p className="text-xs font-bold uppercase tracking-[0.08em] accent-ink">Mixed worksheet finished</p>
        <h1 className="text-3xl font-bold leading-tight">{total} of {marksAvailable} marks</h1>
        <ul className="flex flex-col gap-2">
          {byTopic.map((t) => (
            <li key={t.topicId} className="flex items-center justify-between gap-3 rounded-xl border border-rule bg-surface px-4 py-3 text-sm">
              <Link to={`/subjects/${subjectId}/topics/${t.topicId}`} className="min-w-0 font-bold underline">{t.title}</Link>
              <span className="shrink-0 font-bold tabular-nums">{t.got} / {t.of}</span>
            </li>
          ))}
        </ul>
        <p className="text-ink-2">A topic where marks were lost is the one to go back to: its lesson and worksheets are a tap away.</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link to={printPath} className={`${BUTTON} border border-rule bg-surface`}>Print this sheet</Link>
          <ShareSheet path={path} title={`${subject.name} · mixed worksheet ${spec.code}`} />
          <Link to={makePath} onClick={() => setSession(null)} className={`${BUTTON} bg-[color:var(--subject)] text-white`}>Make another</Link>
        </div>
      </article>
    )
  }

  const at = sheet[session.index]
  if (!at) {
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <p className="text-ink-2">This set of questions has changed since it was started.</p>
        <button type="button" onClick={() => setSession(null)} className={`${BUTTON} w-fit bg-ink text-surface`}>Start again</button>
      </article>
    )
  }
  const k = itemKey(at.item)
  const answered = session.answers[k]
  const last = session.index === sheet.length - 1
  const submit = (answer: Answer) => setSession({ ...session, answers: { ...session.answers, [k]: { answer, result: mark(at.question, answer) } } })
  const claim = () => answered && setSession({ ...session, answers: { ...session.answers, [k]: { ...answered, result: claimAnswer(answered.result) } } })
  const next = () => {
    if (last) {
      const finishedAt = new Date().toISOString()
      const seen = new Map(sheet.map((s) => [itemKey(s.item), s.question]))
      recordReview(session.id, items, session.answers, (id) => loaded.get(id), finishedAt, 'mixed', { seen: (m) => seen.get(itemKey(m)), seed: spec.code })
      setSession({ ...session, finishedAt })
    } else {
      setSession({ ...session, index: session.index + 1 })
    }
    window.scrollTo({ top: 0 })
  }

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <div className="flex justify-between gap-2 text-xs text-ink-2">
          <span className="font-bold uppercase tracking-[0.08em]">Mixed worksheet · {LEVEL[spec.level]}</span>
          <span>{session.index + 1} of {sheet.length}</span>
        </div>
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${sheet.length}, minmax(0, 1fr))` }} role="progressbar" aria-valuemin={1} aria-valuemax={sheet.length} aria-valuenow={session.index + 1}>
          {sheet.map((s, i) => <span key={itemKey(s.item)} className="h-1.5 rounded-full" style={{ background: i <= session.index ? 'var(--subject)' : 'var(--color-rule)' }} />)}
        </div>
        {answered && <p className="text-sm">This was <Link to={`/subjects/${subjectId}/topics/${at.item.topicId}`} className="font-bold underline">{summaryById(at.item.topicId)?.title}</Link>.</p>}
      </header>
      <SessionQuestion subjectId={subjectId} topicId={at.item.topicId} question={at.question} answered={answered} onSubmit={submit} onClaim={claim} />
      {answered && (
        <button type="button" onClick={next} className="h-12 rounded-xl bg-ink px-4 text-base font-bold text-surface">
          {last ? 'See how it went' : 'Next question'}
        </button>
      )}
    </article>
  )
}
