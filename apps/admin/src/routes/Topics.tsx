import { Link } from 'react-router'
import { Placeholder } from '../components/Placeholder.tsx'

export function Topics() {
  return (
    <Placeholder area="Authoring" title="Topics" description="Every topic by subject and unit with its publish state and which of the five parts exist." stories={["ADM-1", "ADM-3"]} blocks={["Subject and unit filter", "Topic rows with part completeness", "Publish state and version"]}>
      <Link to="/topics/example" className="w-fit rounded-lg bg-ink px-4 py-2 text-sm font-bold text-surface">Open example topic</Link>
    </Placeholder>
  )
}
