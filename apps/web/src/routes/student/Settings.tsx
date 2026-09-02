import { Placeholder } from '../../components/Placeholder.tsx'

export function Settings() {
  return (
    <Placeholder
      area={'Student'}
      title={'Settings'}
      description="Display name, password, weekly goal, days off, target grade per subject, exam dates, and accessibility options."
      stories={["FAM-5", "LRN-4", "LRN-6", "MOT-3"]}
      blocks={["Profile", "Weekly goal and days off", "Target grade per subject", "Exam dates", "Dyslexia-friendly font and reduced motion"]}
    >
    </Placeholder>
  )
}
