import { getSubject } from '@study/shared'
import { useParams } from 'react-router'
import { Placeholder } from '../../components/Placeholder.tsx'

export function ExamTechnique() {
  const { subjectId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  return (
    <Placeholder
      area={subject?.name ?? 'Subject'}
      title={'Exam technique'}
      description="Papers, timing, command words, assessment objectives, and what a grade 9 answer looks like for each question type."
      stories={["LRN-5"]}
      blocks={["Paper structure and timing", "Command words", "What separates grade 9 from grade 7", "Examiner-reported errors by topic"]}
    >
    </Placeholder>
  )
}
