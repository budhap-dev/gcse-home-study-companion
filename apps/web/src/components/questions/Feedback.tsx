import type { MarkResult, Question } from '@study/shared'
import { RichText } from '../RichText.tsx'
import { Smiley } from '../Smiley.tsx'

/** Shown after marking: the outcome, the correct answer, and the worked solution. */
export function Feedback({ question, result }: { question: Question; result: MarkResult }) {
  const tone = result.correct ? 'border-status-secure bg-[#DCEFE2]' : result.marksScored > 0 ? 'border-status-developing bg-[#FBF0C9]' : 'border-status-not-secure bg-[#F6E3DA]'
  const heading = result.correct ? 'Correct' : result.marksScored > 0 ? `${result.marksScored} of ${result.marksAvailable} marks` : 'Not quite'
  const face = result.correct ? '😄' : result.marksScored > 0 ? '🙂' : '🤔'
  return (
    <section className={`flex flex-col gap-2 rounded-xl border-l-4 ${tone} p-4 ${result.correct ? 'anim-pop' : 'anim-shake'}`} aria-live="polite">
      <p className="flex items-center gap-2 font-bold"><Smiley bounce className="text-xl">{face}</Smiley>{heading}</p>
      {!result.correct && question.type !== 'extended' && (
        <p className="text-sm">
          Answer: <strong><RichText source={correctAnswer(question)} inline /></strong>
        </p>
      )}
      <RichText source={question.solution} className="text-sm" />
    </section>
  )
}

function correctAnswer(q: Question): string {
  switch (q.type) {
    case 'multiple-choice':
      return q.correct.map((i) => q.options[i]).join(', ')
    case 'numeric':
      return `${q.answer}${q.units ? ` ${q.units}` : ''}`
    case 'short-text':
      return q.accepted[0]!
    case 'ordering':
      return q.items.join(' → ')
    case 'labelling':
      return q.labels.map((l) => l.text).join(', ')
    case 'extended':
      return ''
  }
}
