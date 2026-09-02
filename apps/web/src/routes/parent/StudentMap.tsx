import { Placeholder } from '../../components/Placeholder.tsx'

export function StudentMap() {
  return (
    <Placeholder
      area={'Parent'}
      title={'Topic map'}
      description="The same topic map the student sees, read only."
      stories={["PAR-2"]}
      blocks={["Subject switcher", "Topic map, read only", "Evidence sheet"]}
    >
    </Placeholder>
  )
}
