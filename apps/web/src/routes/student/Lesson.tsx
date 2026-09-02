import { getSubject } from '@study/shared'
import { useParams } from 'react-router'
import { Placeholder } from '../../components/Placeholder.tsx'

export function Lesson() {
  const { subjectId, topicId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  return (
    <Placeholder
      area={`${subject?.name ?? 'Subject'} · ${topicId ?? 'topic'}`}
      title={'Stepped lesson'}
      description="One idea per screen with a visual that carries it, a check question before moving on, and position saved for another device."
      stories={["LRN-2", "LRN-7"]}
      blocks={["Progress indicator", "Visual or interactive block", "Short explanation", "Check question", "Grade 9 step at the end"]}
    >
    </Placeholder>
  )
}
