import { getSubject, WORKSHEET_LEVELS } from '@study/shared'
import { Link, useParams } from 'react-router'
import { StatusChip } from '../../components/StatusChip.tsx'
import { getTopic, totalMarks } from '../../content/index.ts'
import { useProgress } from '../../progress/useProgress.ts'
import { evidenceFor } from '../../progress/store.ts'

const LEVEL_LABEL = { core: 'Core', higher: 'Higher', advanced: 'Advanced' } as const
const LEVEL_NOTE = {
  core: 'Prerequisites only. Short, done once.',
  higher: 'Grade 6 to 8 exam-style questions.',
  advanced: 'Grade 9: multi-step, unfamiliar contexts, show that and explain.',
} as const

export function Topic() {
  const { subjectId, topicId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  const topic = subjectId && topicId ? getTopic(subjectId, topicId) : undefined
  const progress = useProgress()
  if (!subject || !topic) return <p>Unknown topic.</p>
  const evidence = evidenceFor(topic.id, progress)
  const lesson = progress.lessons[topic.id]
  const fmt = (v?: number) => (v === undefined ? 'not yet' : `${Math.round(v)}%`)
  // The two most recent quiz scores, so the stat can show the direction of travel.
  const quizzes = progress.attempts.filter((a) => a.topicId === topic.id && a.kind === 'quiz').sort((a, b) => b.completedAt.localeCompare(a.completedAt))
  const pct = (a: { marksScored: number; marksAvailable: number }) => Math.round((100 * a.marksScored) / a.marksAvailable)
  const quizNote = quizzes.length >= 2 ? (() => { const d = pct(quizzes[0]!) - pct(quizzes[1]!); return d === 0 ? `same as last time` : `${d > 0 ? 'up' : 'down'} from ${pct(quizzes[1]!)}%` })() : undefined

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--subject)]">
          <Link to={`/subjects/${subject.id}`} className="hover:underline">{subject.name}</Link> · {subject.units.find((u) => u.id === topic.unitId)?.name}
        </p>
        <h1 className="text-3xl font-bold leading-tight">{topic.title}</h1>
        <StatusChip status={evidence.status} />
      </header>

      <section className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {[
          ['Lesson', evidence.lessonDone ? 'done' : lesson ? `step ${lesson.stepIndex + 1}` : 'not started'],
          ['Last quiz', fmt(evidence.quizPct), quizNote],
          ['Higher sheet', fmt(evidence.higherPct)],
          ['Advanced sheet', fmt(evidence.advancedPct)],
        ].map(([label, value, note]) => (
          <div key={label} className="flex flex-col gap-0.5 rounded-lg bg-panel px-3 py-2">
            <span className="text-[11px] text-ink-2">{label}</span>
            <span className="font-bold">{value}</span>
            {note && <span className="text-[11px] text-ink-2">{note}</span>}
          </div>
        ))}
      </section>

      <nav aria-label="Topic parts" className="flex flex-col gap-2">
        <Part to="lesson" title="Lesson" note={`${topic.lesson.steps.length} steps, one idea each`} action={lesson && !evidence.lessonDone ? 'Resume' : 'Start'} />
        {WORKSHEET_LEVELS.map((level) => {
          const sheet = topic.worksheets[level]
          return (
            <Part
              key={level}
              to={`worksheet/${level}`}
              title={`${LEVEL_LABEL[level]} worksheet`}
              note={`${sheet.questionIds.length} questions · ${totalMarks(topic, sheet.questionIds)} marks · about ${sheet.suggestedMinutes} min. ${LEVEL_NOTE[level]}`}
              action="Open"
            />
          )
        })}
        <Part to="quiz" title="Quiz" note={`${topic.quiz.sampleSize} questions drawn from ${topic.quiz.questionIds.length}, marked instantly`} action="Start" />
        <Part to="flashcards" title="Flashcards" note="Quick recall: key points, questions, and examiner traps. Tap to flip." action="Flip" />
        <Part to={`/subjects/${subject.id}/exam-technique`} title="Exam technique" note={topic.examTechnique.body.slice(0, 120) + '…'} action="Read" />
      </nav>
    </article>
  )
}

function Part({ to, title, note, action }: { to: string; title: string; note: string; action: string }) {
  return (
    <Link to={to} className="flex items-center gap-4 rounded-xl border border-rule bg-surface px-4 py-3 hover:border-[color:var(--subject)]">
      <span className="flex flex-grow flex-col gap-0.5">
        <span className="font-bold">{title}</span>
        <span className="text-xs text-ink-2">{note}</span>
      </span>
      <span className="rounded-lg bg-[color:var(--subject)] px-3 py-1.5 text-sm font-bold text-white">{action}</span>
    </Link>
  )
}
