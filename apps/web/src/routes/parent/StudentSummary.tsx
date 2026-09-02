import { Placeholder } from '../../components/Placeholder.tsx'

export function StudentSummary() {
  return (
    <Placeholder
      area={'Parent'}
      title={'This week'}
      description="The weekly summary as three questions: what did they work on, which topics are weak, what should they do next."
      stories={["PAR-1", "PAR-4", "PAR-5", "PAR-3"]}
      blocks={["What did they work on, with last week beside it", "Per-subject Grade 9 ready, Secure, below", "Which topics are weak: weakest five", "What next, with suggest to child", "Eight-week trend"]}
    >
    </Placeholder>
  )
}
