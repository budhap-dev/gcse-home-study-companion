import { Placeholder } from '../../components/Placeholder.tsx'

export function Settings() {
  return (
    <Placeholder
      area={'Student'}
      title={'Settings'}
      description="Weekly goal, days off, target grade per subject, exam dates, accessibility options, and clearing progress on this device. Sign-in with Google comes later."
      stories={["LRN-4", "LRN-6", "MOT-3"]}
      blocks={["Weekly goal and days off", "Target grade per subject", "Exam dates", "Dyslexia-friendly font and reduced motion"]}
    >
    </Placeholder>
  )
}
