import { AUTO_MARKED_TYPES, type Question, type WorksheetLevel } from '@study/shared'
import { useState } from 'react'
import { Link } from 'react-router'
import { getGuide } from '../content/index.ts'
import { LENGTH_LABEL, LENGTHS, mixedPath } from '../content/mixedSheet.ts'
import { minutesFor, minutesPerMark } from '../content/paper.ts'
import { newSheetCode } from '../content/sheetCode.ts'

interface TopicLike {
  id: string
  subjectId: string
  questions: Pick<Question, 'id' | 'type' | 'marks'>[]
  worksheets: Record<WorksheetLevel, { questionIds: string[] }>
}

/**
 * "How long have you got?" (13 November 2026): a practice of this topic sized to 10 minutes,
 * 30 minutes or an hour at the exam's pace, Core questions first, with a clock. A topic that
 * cannot fill a length offers everything it has instead, labelled with its real time, so no
 * button promises an hour the topic does not hold.
 */
export function PracticeLengths({ topic, heading = 'Practise for a set time' }: { topic: TopicLike; heading?: string }) {
  const [code] = useState(newSheetCode)
  const onSheets = new Set(Object.values(topic.worksheets).flatMap((s) => s.questionIds))
  const marks = topic.questions.filter((q) => onSheets.has(q.id) && AUTO_MARKED_TYPES.includes(q.type)).reduce((s, q) => s + q.marks, 0)
  const holds = minutesFor(marks, minutesPerMark(getGuide(topic.subjectId)))
  if (!marks) return null
  const fits = LENGTHS.filter((m) => m <= holds + 5)
  const rest = LENGTHS.find((m) => m > holds + 5)
  const choices = [...fits.map((m) => ({ m, label: LENGTH_LABEL[m] })), ...(rest ? [{ m: rest, label: `All · ${holds} min` }] : [])]
  const path = (minutes: number) => mixedPath({ subjectId: topic.subjectId, topicIds: [topic.id], level: 'all', minutes, code })
  return (
    <section aria-labelledby={`lengths-${topic.id}`} className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 id={`lengths-${topic.id}`} className="font-bold">{heading}</h2>
        <p className="text-sm text-ink-2">Questions from every level of this topic, Core first, sized to fit at the exam’s pace, with a clock.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {choices.map(({ m, label }) => <Link key={m} to={path(m)} className="btn btn-secondary min-w-24">{label}</Link>)}
      </div>
    </section>
  )
}
