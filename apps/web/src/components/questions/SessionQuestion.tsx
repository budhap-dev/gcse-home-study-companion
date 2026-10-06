import type { MarkResult, Question } from '@study/shared'
import { Feedback } from './Feedback.tsx'
import { QuestionInput, type Answer } from './QuestionInput.tsx'
import { ReportMistake } from '../ReportMistake.tsx'
import { RichText } from '../RichText.tsx'
import { Visual } from '../Visual.tsx'

/**
 * One question in a session that spans topics (Redo my mistakes, the daily recap): its
 * grade and marks, any drawing, the prompt, the answer field, and the marking once it is in.
 */
export function SessionQuestion({ subjectId, topicId, question, answered, onSubmit, onClaim }: {
  subjectId: string
  topicId: string
  question: Question
  answered?: { result: MarkResult }
  onSubmit: (answer: Answer) => void
  onClaim: () => void
}) {
  const key = `${topicId}/${question.id}`
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-ink-2">
        <span className="rounded bg-panel px-2 py-0.5 font-bold">Grade {question.gradeBand}</span>
        <span>{question.marks} mark{question.marks > 1 ? 's' : ''}</span>
      </div>
      {question.visual && <Visual visual={question.visual} />}
      <RichText source={question.prompt} className="text-[17px] leading-relaxed" />
      <QuestionInput subjectId={subjectId} key={key} question={question} disabled={Boolean(answered)} onSubmit={onSubmit} />
      {answered && <Feedback question={question} result={answered.result} onClaim={onClaim} />}
      <ReportMistake key={`r-${key}`} item={{ subjectId, topicId, itemKind: 'question', itemId: question.id, seenIn: 'worksheet' }} />
    </section>
  )
}
