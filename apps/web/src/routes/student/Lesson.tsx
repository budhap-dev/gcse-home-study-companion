import { getSubject, mark, XP, type MarkResult } from '@study/shared'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { RichText } from '../../components/RichText.tsx'
import { Visual } from '../../components/Visual.tsx'
import { KindChip } from '../../components/KindChip.tsx'
import { SpecNumber } from '../../components/SpecNumber.tsx'
import { Feedback } from '../../components/questions/Feedback.tsx'
import { QuestionInput, type Answer } from '../../components/questions/QuestionInput.tsx'
import { getTopic } from '../../content/index.ts'
import { getState, saveLessonPosition } from '../../progress/store.ts'
import { settle, type Settlement } from '../../progress/settle.ts'
import { Celebration } from '../../components/Celebration.tsx'
import { useActivityTimer } from '../../progress/useActivityTimer.ts'


/**
 * One step per screen. A check question must be answered before moving on the first
 * time through; a wrong answer explains and still allows progress. Position is saved
 * on every step so the lesson resumes where it was left.
 */
/**
 * Two visuals normally sit side by side, which gives each one a 350px box rather than
 * 742px. A table scales its whole drawing to its box, so at half width its 12px text
 * drops to about 8px: present, but not readable. Measured across the content pack, most
 * tables are wider than 350 units, and the static width estimate is only a lower bound
 * (the bold header font is wider than it assumes), so there is no safe threshold to test
 * against. A table therefore never shares a row — it keeps its natural size, capped at
 * 1.1x by the component, and its partner sits below it.
 *
 * Only tables are treated this way: every other diagram is drawn to fit the box it is
 * given, and a vocabulary list is a column of text that reads fine at either width.
 */
function isTable(v: { type: string; component?: string }): boolean {
  return v.type === 'diagram' && v.component === 'trace-table'
}

export function Lesson() {
  const { subjectId, topicId } = useParams()
  const navigate = useNavigate()
  const subject = subjectId ? getSubject(subjectId) : undefined
  const topic = subjectId && topicId ? getTopic(subjectId, topicId) : undefined
  const [params] = useSearchParams()
  const [index, setIndex] = useState(() => {
    const steps = topic?.lesson.steps.length ?? 1
    // A search result links to ?step=N (1-based) and wins over the saved position,
    // because the student asked for that step by name.
    const asked = Number(params.get('step'))
    if (Number.isInteger(asked) && asked >= 1 && asked <= steps) return asked - 1
    const saved = topic ? getState().lessons[topic.id] : undefined
    return saved && !saved.completedAt ? Math.min(saved.stepIndex, steps - 1) : 0
  })
  const [result, setResult] = useState<MarkResult | null>(null)
  const [done, setDone] = useState(false)
  const [celebration, setCelebration] = useState<Settlement | null>(null)
  useActivityTimer(!done)

  useEffect(() => {
    if (topic && !done) saveLessonPosition(topic.id, index)
  }, [topic, index, done])

  if (!subject || !topic) return <p>Unknown topic.</p>
  const steps = topic.lesson.steps
  const step = steps[index]!
  const paired = step.visuals.length > 1 && !step.visuals.some(isTable)
  const last = index === steps.length - 1
  const backTo = `/subjects/${subject.id}/topics/${topic.id}`
  const canAdvance = !step.check || result !== null

  const next = () => {
    if (last) {
      const before = getState()
      saveLessonPosition(topic.id, index, true)
      const outcome = settle(before)
      if (outcome.newBadges.length || outcome.levelUp) setCelebration(outcome)
      setDone(true)
      return
    }
    setResult(null)
    setIndex(index + 1)
    window.scrollTo({ top: 0 })
  }
  const back = () => {
    if (index === 0) return navigate(backTo)
    setResult(null)
    setIndex(index - 1)
    window.scrollTo({ top: 0 })
  }
  const submit = (answer: Answer) => {
    if (step.check) setResult(mark(step.check, answer))
  }

  if (done) {
    return (
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6 text-center">
        {celebration && (
          <Celebration
            title={celebration.levelUp ? `Level up: ${celebration.levelUp.level.name}` : celebration.newBadges[0]!.name}
            detail={celebration.levelUp ? `${subject.name} level ${celebration.levelUp.level.level}` : celebration.newBadges[0]!.description}
            emoji={celebration.levelUp ? '🎉' : celebration.newBadges[0]!.emoji}
            onDone={() => setCelebration(null)}
          />
        )}
        <p className="text-xs font-bold uppercase tracking-[0.08em] accent-ink">Lesson done</p>
        <h1 className="text-3xl font-bold">{topic.title}</h1>
        <p className="text-ink-2">All {steps.length} steps finished, +{steps.length * XP.lessonStep + XP.lessonComplete} XP. The quiz is where you find out what has stuck.</p>
        <section className="flex flex-col gap-2 rounded-2xl border border-rule bg-surface p-4 text-left">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--status-secure-ink)]">What you learned</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {steps.filter((s) => s.kind !== 'summary').map((s) => <li key={s.id} className="flex gap-2"><span className="text-[color:var(--status-secure-ink)]" aria-hidden>✓</span>{s.title.replace(/^(Your turn|Going deeper): /, '')}</li>)}
          </ul>
        </section>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link to={`${backTo}/quiz`} className="flex h-12 items-center justify-center rounded-xl bg-[color:var(--subject)] px-5 font-bold text-white">Take the quiz</Link>
          <Link to={backTo} className="flex h-12 items-center justify-center rounded-xl border border-rule bg-surface px-5 font-bold">Back to topic</Link>
        </div>
      </article>
    )
  }

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex items-center gap-3">
        <button type="button" onClick={back} aria-label={index === 0 ? 'Back to topic' : 'Previous step'} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-rule bg-surface">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="flex flex-grow flex-col gap-1.5">
          <div className="flex justify-between gap-2 text-xs text-ink-2">
            <span className="line-clamp-1 font-bold uppercase tracking-[0.06em] accent-ink">{subject.name} · {topic.title}</span>
            <span className="shrink-0 whitespace-nowrap">Step {index + 1} of {steps.length}</span>
          </div>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1}>
            {steps.map((s, i) => (
              <span key={s.id} className="h-1.5 rounded-full" style={{ background: i <= index ? 'var(--subject)' : 'var(--color-rule)' }} />
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2">
          <KindChip kind={step.kind} />
          <SpecNumber code={step.specPoint} className="text-xs" />
        </span>
        <h1 className="text-2xl font-bold leading-tight">{step.title}</h1>
      </div>

      <div className={paired ? 'grid grid-cols-1 items-start gap-4 md:grid-cols-2' : 'flex flex-col gap-4'}>
        {step.visuals.map((v, i) => (
          <Visual key={i} visual={v} />
        ))}
      </div>

      <RichText source={step.body} className="text-[17px] leading-relaxed" />

      {step.check && (
        <section className="tint flex flex-col gap-3 rounded-2xl border border-[color:var(--subject)] p-4">
          <KindChip kind="check" />
          <RichText source={step.check.prompt} className="font-bold" />
          <QuestionInput subjectId={subjectId} key={step.id} question={step.check} disabled={result !== null} onSubmit={submit} />
          {result && <Feedback question={step.check} result={result} />}
        </section>
      )}

      <button type="button" onClick={next} disabled={!canAdvance} className="h-12 rounded-xl bg-ink px-4 text-base font-bold text-surface disabled:opacity-40">
        {last ? 'Finish lesson' : 'Next step'}
      </button>
    </article>
  )
}
