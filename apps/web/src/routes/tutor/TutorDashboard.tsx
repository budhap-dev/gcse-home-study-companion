import { Link } from 'react-router'
import { Placeholder } from '../../components/Placeholder.tsx'

export function TutorDashboard() {
  return (
    <Placeholder
      area={'Tutor'}
      title={'Your students'}
      description="Every linked student with days since last activity, weekly minutes, and the three weakest topics."
      stories={["TUT-2", "TUT-1"]}
      blocks={["Student rows with weakest topics", "Pending invites"]}
    >
      <ul className="flex flex-col gap-2">
        <li><Link to="/tutor/students/student-1" className="block rounded-xl border border-rule bg-surface px-4 py-3 font-bold">Example student</Link></li>
      </ul>
    </Placeholder>
  )
}
