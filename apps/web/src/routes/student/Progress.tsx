import { Placeholder } from '../../components/Placeholder.tsx'

export function Progress() {
  return (
    <Placeholder
      area={'Student'}
      title={'Progress'}
      description="Points, subject levels, this week, and the study streak."
      stories={["MOT-1", "PRG-2", "MOT-2"]}
      blocks={["Subject level bars", "This week activity", "Streak and days off", "Badges"]}
    >
    </Placeholder>
  )
}
