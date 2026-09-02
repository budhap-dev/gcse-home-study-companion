import { Link } from 'react-router'
import { Placeholder } from '../../components/Placeholder.tsx'

export function ParentHome() {
  return (
    <Placeholder
      area={'Parent'}
      title={'Your family'}
      description="Every child in the family, each with a one-line status, plus family management."
      stories={["FAM-1", "FAM-2", "FAM-3", "FAM-4"]}
      blocks={["Children with last activity", "Add a student", "Invite a second parent", "Invite a tutor for a child"]}
    >
      <ul className="flex flex-col gap-2">
        <li><Link to="/parent/student-1" className="block rounded-xl border border-rule bg-surface px-4 py-3 font-bold">Example child · weekly summary</Link></li>
        <li><Link to="/parent/student-1/map" className="block rounded-xl border border-rule bg-surface px-4 py-3 font-bold">Example child · topic map</Link></li>
      </ul>
    </Placeholder>
  )
}
