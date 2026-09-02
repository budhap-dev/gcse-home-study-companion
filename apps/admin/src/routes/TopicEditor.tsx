import { Placeholder } from '../components/Placeholder.tsx'

export function TopicEditor() {
  return (
    <Placeholder area="Authoring" title="Topic editor" description="All five parts on one screen with live validation against the publish rules and a preview using the real step and question components." stories={["ADM-1", "ADM-6", "ADM-3"]} blocks={["Draft with AI or start blank", "Lesson steps with visual check", "Three worksheets", "Exam technique note", "Quiz pool", "AI-drafted flag, reviewer, and review state", "Validation panel and publish"]}>
    </Placeholder>
  )
}
