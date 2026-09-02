import { Placeholder } from '../../components/Placeholder.tsx'

export function Home() {
  return (
    <Placeholder
      area={'Student'}
      title={'Afternoon'}
      description="One recommended task with its reason, two alternatives, the weekly goal ring, and any task a parent or tutor has set."
      stories={["LRN-3", "MOT-5", "MOT-3", "TUT-3"]}
      blocks={["Greeting and streak", "Weekly goal ring", "Tasks set by a parent or tutor", "Next up: recommended task with reason", "Two alternatives including quick quiz", "Subjects strip with Grade 9 ready counts"]}
    >
    </Placeholder>
  )
}
