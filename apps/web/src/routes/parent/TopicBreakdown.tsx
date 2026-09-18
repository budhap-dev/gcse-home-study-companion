import { expectedAnswer, type Question } from '@study/shared'
import { RichText } from '../../components/RichText.tsx'
import { StatusChip } from '../../components/StatusChip.tsx'
import { TOPICS } from '../../content/index.ts'
import { evidenceFor, type AttemptRecord, type ProgressState, type QuestionResult } from '../../progress/store.ts'

const WHEN = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const pct = (a: AttemptRecord) => (a.marksAvailable > 0 ? Math.round((100 * a.marksScored) / a.marksAvailable) : 0)
const nameOf = (a: AttemptRecord) => (a.kind === 'quiz' ? 'Quiz' : `${a.level![0]!.toUpperCase()}${a.level!.slice(1)} worksheet`)

/**
 * Every attempt on one topic, question by question.
 *
 * The per-question results have been recorded all along; the question text, the skill and
 * the right answer come from the content pack bundled into the app, looked up by id. So
 * this needs nothing from the database that was not already there.
 *
 * `answer` is only present on attempts made since it started being recorded, and never on
 * an extended question, which is self-assessed against a mark scheme rather than typed —
 * so every row has to read sensibly without it.
 */
export function TopicBreakdown({ topicId, state }: { topicId: string; state: ProgressState }) {
  const topic = TOPICS.find((t) => t.id === topicId)
  const attempts = state.attempts
    .filter((a) => a.topicId === topicId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
  const lesson = state.lessons[topicId]
  if (!topic) return <p className="text-sm text-ink-2">This topic is not in the app.</p>

  const byId = new Map(topic.questions.map((q) => [q.id, q as Question]))
  return (
    <div className="flex flex-col gap-3 border-t border-rule pt-3">
      <p className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
        <StatusChip status={evidenceFor(topicId, state).status} />
        <span>
          {lesson?.completedAt ? `Lesson finished ${WHEN(lesson.completedAt)}.` : lesson ? `Lesson started, stopped at step ${lesson.stepIndex + 1} of ${topic.lesson.steps.length}.` : 'Lesson not started.'}
        </span>
      </p>

      {attempts.length === 0 ? (
        <p className="text-sm text-ink-2">No quiz or worksheet attempted on this topic yet.</p>
      ) : (
        attempts.map((a) => (
          <details key={a.id} className="rounded-xl border border-rule bg-surface">
            <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="font-bold">{nameOf(a)} <span className="font-normal text-ink-2">· {WHEN(a.completedAt)}</span></span>
              <span className="flex items-center gap-2">
                {a.markedHow !== 'auto' && <span className="text-xs text-ink-3">{a.markedHow === 'self' ? 'self-marked' : 'partly self-marked'}</span>}
                <strong className="tabular-nums">{a.marksScored} of {a.marksAvailable} · {pct(a)}%</strong>
              </span>
            </summary>
            {a.questions?.length
              ? (
                <ol className="flex flex-col gap-2 border-t border-rule px-3 py-3">
                  {a.questions.map((r, i) => <QuestionRow key={r.id} n={i + 1} result={r} question={byId.get(r.id)} />)}
                </ol>
              )
              : <p className="border-t border-rule px-3 py-3 text-sm text-ink-2">This attempt was recorded before the app kept question-by-question results.</p>}
          </details>
        ))
      )}
    </div>
  )
}

function QuestionRow({ n, result, question }: { n: number; result: QuestionResult; question?: Question }) {
  const right = result.correct
  const part = !right && result.marksScored > 0
  const expected = question ? expectedAnswer(question) : undefined
  return (
    <li className={`flex flex-col gap-1 rounded-lg border-l-4 bg-paper px-3 py-2 ${right ? 'border-l-status-secure' : part ? 'border-l-[#c27a00]' : 'border-l-status-not-secure'}`}>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-sm">
          <span className="mr-1 font-bold tabular-nums text-ink-2">{n}.</span>
          {question ? <RichText source={question.prompt} className="inline text-sm" /> : <span className="text-ink-2">Question {result.id}</span>}
        </span>
        <span className="shrink-0 whitespace-nowrap text-xs font-bold">
          {right ? <span className="text-status-secure">✓ {result.marksScored}/{result.marksAvailable}</span>
            : <span className={part ? 'text-[#8a6d1d]' : 'text-status-not-secure'}>{part ? '~' : '✗'} {result.marksScored}/{result.marksAvailable}</span>}
        </span>
      </span>
      {!right && (
        <span className="flex flex-col gap-0.5 text-xs">
          {result.answer !== undefined
            ? <span className="text-ink-2">They put: <RichText source={result.answer} className="inline text-xs font-bold text-ink" /></span>
            : <span className="text-ink-3">Their answer was not recorded on this attempt.</span>}
          {expected && <span className="text-ink-2">Answer: <RichText source={expected} className="inline text-xs font-bold text-ink" /></span>}
        </span>
      )}
      <span className="text-[11px] text-ink-3">{result.skill} · grade {result.gradeBand}</span>
    </li>
  )
}
