import { getSubject } from '@study/shared'
import { useParams } from 'react-router'
import { Placeholder } from '../../components/Placeholder.tsx'

export function Quiz() {
  const { subjectId, topicId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  return (
    <Placeholder
      area={`${subject?.name ?? 'Subject'} · ${topicId ?? 'topic'}`}
      title={'Topic quiz'}
      description="Ten to twenty auto-marked questions with a worked solution after each, and a summary linking misses back to the lesson step."
      stories={["QZ-1", "QZ-2"]}
      blocks={["Question with the right input type", "Mark on submit with worked solution", "Extended response with self-assessment against the scheme", "Summary with score, time, and misses"]}
    >
    </Placeholder>
  )
}
