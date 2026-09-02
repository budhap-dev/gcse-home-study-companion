import { Placeholder } from '../../components/Placeholder.tsx'

export function TutorStudent() {
  return (
    <Placeholder
      area={'Tutor'}
      title={'Student'}
      description="Read-only topic map and attempt history, assigned tasks with status, and private notes."
      stories={["TUT-3", "TUT-4", "PAR-2"]}
      blocks={["Topic map", "Attempt history", "Assign a task with a due date", "Assigned tasks with done, overdue, not started", "Private notes"]}
    >
    </Placeholder>
  )
}
