import { getSubject, WORKSHEET_LEVELS } from '@study/shared'
import { Smiley } from '../../components/Smiley.tsx'
import { Link, useParams } from 'react-router'
import { RichText } from '../../components/RichText.tsx'
import { termsForTopic } from '../../content/glossary.ts'
import { StatusChip } from '../../components/StatusChip.tsx'
import { getTopic, totalMarks } from '../../content/index.ts'
import { useProgress } from '../../progress/useProgress.ts'
import { evidenceFor } from '../../progress/store.ts'
import { ResetProgress } from '../../components/ResetProgress.tsx'

/**
 * A short preview of a rich-text body, cut on a sentence end that is outside any
 * maths span. A blind slice splits `$E_e = \tfrac{1}{2}ke^2$` down the middle and the
 * card shows the raw LaTeX, which is what four topics used to do.
 */
export function previewOf(body: string, max = 150): string {
  let depth = 0
  let cut = 0
  for (let i = 0; i < body.length && i < max; i++) {
    if (body[i] === '$') depth = depth === 0 ? 1 : 0
    if (depth === 0 && (body[i] === '.' || body[i] === '!' || body[i] === '?') && body[i + 1] === ' ') cut = i + 1
  }
  if (cut > 0) return body.slice(0, cut)
  // No sentence ended in range: fall back to the whole body if it is short, else
  // the longest prefix that closes every maths span it opens.
  if (body.length <= max) return body
  let safe = 0
  depth = 0
  for (let i = 0; i < max; i++) {
    if (body[i] === '$') depth = depth === 0 ? 1 : 0
    if (depth === 0 && body[i] === ' ') safe = i
  }
  return body.slice(0, safe || max) + '…'
}

const LEVEL_LABEL = { core: 'Core', higher: 'Higher', advanced: 'Advanced' } as const
const LEVEL_NOTE = {
  core: 'Prerequisites only. Short, done once.',
  higher: 'Exam-style questions on the main ideas.',
  advanced: 'Multi-step problems in unfamiliar contexts. Show that, and explain.',
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
    <article className="mx-auto flex w-full max-w-6xl flex-col gap-6">
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

      <nav aria-label="Topic parts" className="grid grid-cols-1 gap-2 md:grid-cols-2">
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
        <Part to={`/subjects/${subject.id}/exam-technique`} title="Exam technique" note={previewOf(topic.examTechnique.body)} action="Read" />
      </nav>

      {topic.tips && topic.tips.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="chip w-fit" style={{ '--chip': '#c27a00' } as React.CSSProperties}><Smiley>💡</Smiley>Tips and tricks</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {topic.tips.map((tip, i) => (
              <li key={i} className="flex flex-col gap-1 rounded-xl border border-rule bg-surface px-4 py-3">
                <span className="flex items-center gap-2">
                  <Smiley>{TIP_EMOJI[tip.kind]}</Smiley>
                  <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">{TIP_LABEL[tip.kind]}</span>
                </span>
                <span className="font-bold">{tip.title}</span>
                <RichText source={tip.body} className="text-sm" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {termsForTopic(topic.id).length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="chip w-fit" style={{ '--chip': '#6B4E9B' } as React.CSSProperties}><Smiley>📖</Smiley>Key terms</h2>
          <ul className="flex flex-wrap gap-2">
            {termsForTopic(topic.id).map((term) => (
              <li key={term.slug}>
                <Link to={`/glossary?term=${term.slug}`} className="inline-flex min-h-9 items-center rounded-full border border-rule bg-surface px-3 text-sm hover:border-[color:var(--subject)]">
                  {term.term}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {topic.resources && topic.resources.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="chip w-fit" style={{ '--chip': '#1f3a93' } as React.CSSProperties}><Smiley>💻</Smiley>Practise</h2>
          {topic.resources.map((r) => (
            <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className="press flex items-center justify-between gap-3 rounded-xl border border-rule bg-surface px-4 py-3">
              <span className="flex flex-col"><span className="font-bold">{r.label}</span>{r.note && <span className="text-sm text-ink-2">{r.note}</span>}</span>
              <span className="shrink-0 rounded-lg bg-[color:var(--subject)] px-4 py-2 text-sm font-bold text-white">Open</span>
            </a>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2 border-t border-rule pt-5">
        <ResetProgress
          label="Reset this topic"
          what="this topic"
          topicIds={[topic.id]}
          hasProgress={progress.attempts.some((a) => a.topicId === topic.id) || Boolean(progress.lessons[topic.id])}
        />
      </section>
    </article>
  )
}

/** Four kinds of tip: how to remember it, how to spot it, a faster route, a way to check. */
const TIP_EMOJI: Record<string, string> = { remember: '🧠', spot: '🔍', shortcut: '⚡', check: '✅' }
const TIP_LABEL: Record<string, string> = { remember: 'Remember it', spot: 'Spot it', shortcut: 'Quicker way', check: 'Check it' }

const PART_EMOJI: Record<string, string> = { Lesson: '📖', 'Core worksheet': '📝', 'Higher worksheet': '📝', 'Advanced worksheet': '🧠', Quiz: '⚡', Flashcards: '🃏', 'Exam technique': '🎓' }

function Part({ to, title, note, action }: { to: string; title: string; note: string; action: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-rule bg-surface px-4 py-3 hover:border-[color:var(--subject)]">
      <span className="tint flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"><Smiley>{PART_EMOJI[title] ?? '📚'}</Smiley></span>
      <span className="flex flex-grow flex-col gap-0.5">
        <span className="font-bold">{title}</span>
        <RichText source={note} inline className="text-xs text-ink-2" />
      </span>
      <span className="rounded-lg bg-[color:var(--subject)] px-3 py-1.5 text-sm font-bold text-white">{action}</span>
    </Link>
  )
}
