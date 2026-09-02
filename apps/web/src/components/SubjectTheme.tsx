import { getSubject } from '@study/shared'
import { useParams } from 'react-router'

/**
 * Sets the subject accent for everything rendered inside it, so each subject's
 * screens feel like a different room while the controls stay the same.
 */
export function SubjectTheme({ children }: { children: React.ReactNode }) {
  const { subjectId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  const style = subject
    ? ({ '--subject': subject.colour, '--subject-soft': `${subject.colour}1a` } as React.CSSProperties)
    : undefined
  return (
    <div data-subject={subject?.id} style={style} className="contents">
      {children}
    </div>
  )
}
