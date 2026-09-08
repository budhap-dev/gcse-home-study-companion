import { Placeholder } from '../../components/Placeholder.tsx'

export function Home() {
  return (
    <Placeholder
      area={'Student'}
      title={'Afternoon'}
      description="One recommended task with its reason, two alternatives, and the weekly goal ring. Progress is saved on this device until sign-in arrives."
      stories={["LRN-3", "MOT-5", "MOT-3"]}
      blocks={["Streak", "Weekly goal ring", "Next up: recommended task with reason", "Two alternatives including quick quiz", "Subjects strip with Grade 9 ready counts"]}
    >
    </Placeholder>
  )
}
