import { getSubject, mark, type MarkResult } from '@study/shared'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { RichText } from '../../components/RichText.tsx'
import { Visual } from '../../components/Visual.tsx'
import { Feedback } from '../../components/questions/Feedback.tsx'
import { QuestionInput, type Answer } from '../../components/questions/QuestionInput.tsx'
import { getTopic } from '../../content/index.ts'
import { getState, saveLessonPosition } from '../../progress/store.ts'
import { settle, type Settlement } from '../../progress/settle.ts'
import { Celebration } from '../../components/Celebration.tsx'
import { useActivityTimer } from '../../progress/useActivityTimer.ts'

const KIND_LABEL = { explain: 'Explain', 'worked-example': 'Worked example', 'your-turn': 'Your turn', summary: 'Summary', 'grade-9': 'Grade 9' } as const

/**
 * One step per screen. A check question must be answered before moving on the first
 * time through; a wrong answer explains and still allows progress. Position is saved
 * on every step so the lesson resumes where it was left.
 */
export function Lesson() {
  const { subjectId, topicId } = useParams()
  const navigate = useNavigate()
  const subject = subjectId ? getSubject(subjectId) : undefined
  const topic = subjectId && topicId ? getTopic(subjectId, topicId) : undefined
  const [index, setIndex] = useState(() => {
    const saved = topic ? getState().lessons[topic.id] : undefined
    return saved && !saved.completedAt ? Math.min(saved.stepIndex, (topic?.lesson.steps.length ?? 1) - 1) : 0
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
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--subject)]">Lesson done</p>
        <h1 className="text-3xl font-bold">{topic.title}</h1>
        <p className="text-ink-2">All {steps.length} steps finished, +{steps.length * 3 + 15} XP. The quiz is how this topic moves from Developing to Secure.</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link to={`${backTo}/quiz`} className="flex h-12 items-center justify-center rounded-xl bg-[color:var(--subject)] px-5 font-bold text-white">Take the quiz</Link>
          <Link to={backTo} className="flex h-12 items-center justify-center rounded-xl border border-rule bg-surface px-5 font-bold">Back to topic</Link>
        </div>
      </article>
    )
  }

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <header className="flex items-center gap-3">
        <button type="button" onClick={back} aria-label={index === 0 ? 'Back to topic' : 'Previous step'} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-rule bg-surface">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="flex flex-grow flex-col gap-1.5">
          <div className="flex justify-between text-xs text-ink-2">
            <span className="font-bold uppercase tracking-[0.06em] text-[color:var(--subject)]">{subject.name} · {topic.title}</span>
            <span>Step {index + 1} of {steps.length}</span>
          </div>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1}>
            {steps.map((s, i) => (
              <span key={s.id} className="h-1.5 rounded-full" style={{ background: i <= index ? 'var(--subject)' : 'var(--color-rule)' }} />
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">{KIND_LABEL[step.kind]}</p>
        <h1 className="text-2xl font-bold leading-tight">{step.title}</h1>
      </div>

      <div className="flex flex-col gap-4">
        {step.visuals.map((v, i) => (
          <Visual key={i} visual={v} />
        ))}
      </div>

      <RichText source={step.body} className="text-[17px] leading-relaxed" />

      {step.check && (
        <section className="flex flex-col gap-3 rounded-2xl bg-panel p-4">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Check</p>
          <RichText source={step.check.prompt} className="font-bold" />
          <QuestionInput key={step.id} question={step.check} disabled={result !== null} onSubmit={submit} />
          {result && <Feedback question={step.check} result={result} />}
        </section>
      )}

      <button type="button" onClick={next} disabled={!canAdvance} className="h-12 rounded-xl bg-ink px-4 text-base font-bold text-surface disabled:opacity-40">
        {last ? 'Finish lesson' : 'Next step'}
      </button>
    </article>
  )
}
