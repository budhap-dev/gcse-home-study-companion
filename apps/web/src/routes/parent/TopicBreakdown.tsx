import { expectedAnswer, sheetQuestions, type Question } from '@study/shared'
import { RichText } from '../../components/RichText.tsx'
import { StatusChip } from '../../components/StatusChip.tsx'
import { summaryById } from '../../content/index.ts'
import { useTopic } from '../../content/load.ts'
import { attemptName, evidenceFor, type AttemptRecord, type ProgressState, type QuestionResult } from '../../progress/store.ts'

const WHEN = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const pct = (a: AttemptRecord) => (a.marksAvailable > 0 ? Math.round((100 * a.marksScored) / a.marksAvailable) : 0)

/**
 * Every attempt on one topic, question by question.
 *
 * The per-question results have been recorded all along; the question text, the skill and
 * the right answer come from the topic's content, fetched when the breakdown is opened and
 * looked up by id. So this needs nothing from the database that was not already there.
 *
 * `answer` is only present on attempts made since it started being recorded, and never on
 * an extended question, which is self-assessed against a mark scheme rather than typed —
 * so every row has to read sensibly without it.
 *
 * A worksheet retry with a `seed` had generated questions in place of some written ones, and
 * the seed rebuilds them: looked up by id alone, the row would print the written question's
 * numbers beside the answer the student gave to different ones.
 */
export function TopicBreakdown({ topicId, state }: { topicId: string; state: ProgressState }) {
  const topic = summaryById(topicId)
  // The questions' text and answers come with the full topic; rows show without them until it arrives.
  const full = useTopic(topic?.subjectId, topicId)
  const attempts = state.attempts
    .filter((a) => a.topicId === topicId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
  const lesson = state.lessons[topicId]
  if (!topic) return <p className="text-sm text-ink-2">This topic is not in the app.</p>

  const byId = new Map<string, Question>((full?.questions ?? []).map((q) => [q.id, q]))
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
              <span className="font-bold">{attemptName(a)} <span className="font-normal text-ink-2">· {WHEN(a.completedAt)}</span></span>
              <span className="flex items-center gap-2">
                {a.markedHow !== 'auto' && <span className="text-xs text-ink-3">{a.markedHow === 'self' ? 'self-marked' : 'partly self-marked'}</span>}
                <strong className="tabular-nums">{a.marksScored} of {a.marksAvailable} · {pct(a)}%</strong>
              </span>
            </summary>
            {a.questions?.length
              ? (
                <ol className="flex flex-col gap-2 border-t border-rule px-3 py-3">
                  {asSeen(a, byId, topic.subjectId).map(([r, q], i) => <QuestionRow key={r.id} n={i + 1} result={r} question={q} />)}
                </ol>
              )
              : <p className="border-t border-rule px-3 py-3 text-sm text-ink-2">This attempt was recorded before the app kept question-by-question results.</p>}
          </details>
        ))
      )}
    </div>
  )
}

/** Each result with the question as the student saw it on that attempt. */
export function asSeen(a: AttemptRecord, byId: Map<string, Question>, subjectId: string): [QuestionResult, Question | undefined][] {
  const results = a.questions ?? []
  const written = results.map((r) => byId.get(r.id))
  if (!a.seed || written.some((q) => !q)) return results.map((r, i) => [r, written[i]])
  const seen = sheetQuestions(subjectId, a.topicId, written as Question[], a.seed)
  return results.map((r, i) => [r, seen[i]!.question])
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
          {right ? <span className="text-[color:var(--status-secure-ink)]">✓ {result.marksScored}/{result.marksAvailable}</span>
            : <span className={part ? 'text-[#8a6d1d]' : 'text-[color:var(--status-not-secure-ink)]'}>{part ? '~' : '✗'} {result.marksScored}/{result.marksAvailable}</span>}
        </span>
      </span>
      {result.claimed && (
        <span className="flex flex-col gap-0.5 text-xs">
          {result.answer !== undefined && <span className="text-ink-2">They put: <RichText source={result.answer} className="inline text-xs font-bold text-ink" /></span>}
          {expected && <span className="text-ink-2">Model answer: <RichText source={expected} className="inline text-xs font-bold text-ink" /></span>}
          <span className="text-ink-3">The marker did not match it; they said it means the same and counted it.</span>
        </span>
      )}
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
