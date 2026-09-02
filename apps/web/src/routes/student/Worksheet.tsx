import { getSubject } from '@study/shared'
import { useParams } from 'react-router'
import { Placeholder } from '../../components/Placeholder.tsx'

export function Worksheet() {
  const { subjectId, topicId, level } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  return (
    <Placeholder
      area={`${subject?.name ?? 'Subject'} · ${topicId ?? 'topic'}`}
      title={`${level ?? 'Higher'} worksheet`}
      description="Question, scratch canvas, and worked solution side by side on a tablet, stacked on a phone. Final answers auto-mark; method marks are self-marked."
      stories={["WKS-1", "WKS-3", "WKS-7", "WKS-2"]}
      blocks={["Question navigator", "Question with final answer input and maths keypad", "Handwriting canvas saved with the attempt", "Reveal solution and award method marks", "Running total"]}
    >
    </Placeholder>
  )
}
