import { getSubject } from '@study/shared'
import { Link, useParams } from 'react-router'
import { Placeholder } from '../../components/Placeholder.tsx'

export function Topic() {
  const { subjectId, topicId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  return (
    <Placeholder
      area={subject?.name ?? 'Subject'}
      title={topicId ?? 'Topic'}
      description="The five parts of a topic in one place: lesson, three worksheets, exam technique note, and quiz, with what is done."
      stories={["LRN-1", "WKS-1"]}
      blocks={["Status and evidence", "Lesson with resume position", "Worksheets at Core, Higher, Advanced with marks and time", "Exam technique note", "Quiz with last score"]}
    >
      <nav aria-label="Topic parts" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Link to="lesson" className="rounded-xl border border-rule bg-surface px-4 py-3 font-bold hover:border-[color:var(--subject)]">Lesson</Link>
        <Link to="quiz" className="rounded-xl border border-rule bg-surface px-4 py-3 font-bold hover:border-[color:var(--subject)]">Quiz</Link>
        <Link to="worksheet/core" className="rounded-xl border border-rule bg-surface px-4 py-3 font-bold hover:border-[color:var(--subject)]">Core worksheet</Link>
        <Link to="worksheet/higher" className="rounded-xl border border-rule bg-surface px-4 py-3 font-bold hover:border-[color:var(--subject)]">Higher worksheet</Link>
        <Link to="worksheet/advanced" className="rounded-xl border border-rule bg-surface px-4 py-3 font-bold hover:border-[color:var(--subject)]">Advanced worksheet</Link>
        <Link to={`/subjects/${subjectId}/exam-technique`} className="rounded-xl border border-rule bg-surface px-4 py-3 font-bold hover:border-[color:var(--subject)]">Exam technique</Link>
      </nav>
    </Placeholder>
  )
}
