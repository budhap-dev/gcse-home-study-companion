import { Placeholder } from '../../components/Placeholder.tsx'

export function SignUp() {
  return (
    <Placeholder
      area={'Account'}
      title={'Create a family'}
      description="A parent creates the account and the family, verifies their email, then adds a student."
      stories={["FAM-1", "FAM-2"]}
      blocks={["Parent account", "Email verification", "First student with subjects and boards"]}
    >
    </Placeholder>
  )
}
