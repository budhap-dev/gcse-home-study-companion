import { Link } from 'react-router'
import { Placeholder } from '../../components/Placeholder.tsx'

export function SignIn() {
  return (
    <Placeholder
      area={'Account'}
      title={'Sign in'}
      description="Parents and tutors sign in with email, Google, or Apple. Students sign in with the username their parent set."
      stories={["FAM-1", "FAM-2"]}
      blocks={["Email and password", "Google and Apple", "Student username sign-in"]}
    >
      <p className="text-sm text-ink-2">New here? <Link to="/sign-up" className="font-bold underline">Create a family</Link></p>
    </Placeholder>
  )
}
