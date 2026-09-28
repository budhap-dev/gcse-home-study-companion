# Resources

One JSON file per subject, named by subject id, validated against `ResourceFile` in
`packages/shared/src/resources.ts`. The app bundles them at build time, the same way it
bundles the glossary, and the Resources page (`/resources`) lists every one.

A resource is reference material a student comes back to: a formula sheet, the periodic
table, circuit symbols, a verb table. It teaches nothing new. It gathers what the lessons
use and says plainly what the exam does with it.

| Field | Meaning |
|---|---|
| `status` | `given` (printed in the paper), `learn` (not in the paper), or `reference` (a map of the course). |
| `statusNote` | Required when `given`: which year's sheet it follows, and anything it leaves off. |
| `sources` | The board's own documents, with the section. At least one, never only Bitesize. |
| `furtherReading` | Bitesize pages. |
| `topics` | Topic ids that use it, in its own subject. |
| `applications` | "Where you meet it": at least two real uses outside the exam, once written. |
| `blocks` | The resource itself: `formulae`, `table`, `text` or `visual`. Empty means Coming soon. |

## Redrawn, never copied

AQA's copyright policy says its materials "must not be reproduced on third party websites
– in any format". Pearson allows copies only on an approved centre's non-public intranet,
and the BBC's terms need permission for Bitesize diagrams. This app is public, so every
sheet and chart is redrawn here and checked against the board's PDF, and the page links
to that PDF. Linking is always allowed.

## Given or learn

The status follows Ofqual's decision of 5 May 2026: formulae sheets for GCSE Maths and
equation sheets for GCSE Physics are provided for exams from 2028 onwards, and each
board publishes the year's sheet by 1 September of the year before. So a `given` note
says which sheet it follows, and is checked again when the next one is published.
Further Maths 8365 is a Level 2 Certificate, not a GCSE, and the decision does not name
it. Edexcel Business says its formulae "will not be provided in the examinations".

## Rules the tests enforce

- A file per subject; no repeated id within a subject.
- Links are https, to the boards, Ofqual or Bitesize only.
- A `given` resource says which sheet it follows.
- Every `topics` id exists and belongs to the resource's subject.
- A written resource has topics and at least two applications.
- Formula group colours hold AA against white; table rows have one cell per column.
