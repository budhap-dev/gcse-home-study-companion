
import { Placeholder } from '../components/Placeholder.tsx'

export function Draft() {
  return (
    <Placeholder
      area="Authoring"
      title="Draft with AI"
      description="Give a topic title, the specification points it covers, and the grade band. The tool drafts all five parts against the content schema and saves them as an unpublished, AI-drafted version for a human to review. Nothing publishes without that review."
      stories={["ADM-6", "ADM-7", "ADM-3"]}
      blocks={["Brief: subject, unit, topic title, specification points, notes on emphasis and misconceptions", "Parts arriving as they stream: lesson steps, Core, Higher, Advanced, exam technique, quiz", "Schema and publish-rule check on the draft: visual on every step, grade 9 step, 40% grade 8 to 9 questions", "Regenerate one part or one question without losing edits elsewhere", "Save as unpublished version marked AI-drafted with model and prompt version", "Question batch mode: topic, skill, grade band, type, count; results land in the bank as unreviewed"]}
    >
      <p className="text-sm text-ink-2">
        Drafting runs on the server through a function that holds the API key. The editor never talks to the model directly.
      </p>
    </Placeholder>
  )
}
