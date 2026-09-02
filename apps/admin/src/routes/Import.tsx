import { Placeholder } from '../components/Placeholder.tsx'

export function Import() {
  return (
    <Placeholder area="Authoring" title="Import" description="Load a topic pack or question batch from JSON or a spreadsheet, validated before anything is written." stories={["ADM-5"]} blocks={["File drop", "Validation report", "Commit"]}>
    </Placeholder>
  )
}
