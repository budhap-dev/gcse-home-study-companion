import { BIOLOGY_POINTS } from './biology.ts'
import { BUSINESS_POINTS } from './business.ts'
import { CHEMISTRY_POINTS } from './chemistry.ts'
import { COMPUTER_SCIENCE_POINTS } from './computer-science.ts'
import { FURTHER_MATHS_POINTS } from './further-maths.ts'
import { MATHS_POINTS } from './maths.ts'
import { PHYSICS_POINTS } from './physics.ts'
import { SUBSECTION_NAMES } from './subsections.ts'
import type { SpecSection } from './types.ts'

export type { SpecPoint, SpecSection } from './types.ts'

/**
 * Every numbered point of each board's specification, for the specification checklist
 * (specification order, step 3): each point, the topics that teach it, and the points that
 * nothing teaches, named. Subjects are added one at a time, each from its board's PDF.
 */
export const SPEC_POINTS: Record<string, SpecSection[]> = {
  maths: MATHS_POINTS,
  'further-maths': FURTHER_MATHS_POINTS,
  'computer-science': COMPUTER_SCIENCE_POINTS,
  business: BUSINESS_POINTS,
  physics: PHYSICS_POINTS,
  chemistry: CHEMISTRY_POINTS,
  biology: BIOLOGY_POINTS,
}

/**
 * Points no topic lists, and why, said on the checklist so the gap is a decision and not an
 * oversight. A test fails when one of them gains a topic.
 */
export const NO_TOPIC: Record<string, Record<string, string>> = {
  maths: {
    A8: 'Coordinates in all four quadrants are used throughout the pack, in every graph topic, and have no topic of their own.',
  },
  physics: {
    '4.2.4.2': 'Not yet taught: E = Pt is taught with power (4.1.1.4), but E = QV, which the specification says to recall and apply, and how appliances transfer energy from batteries or the mains, have no lesson yet.',
  },
  'further-maths': {
    '1.1': 'The specification says this GCSE number work is expected, not taught: it is used throughout and has no topic of its own.',
  },
}

/**
 * Whether a topic's list of points covers a checklist point: by naming it, or by naming a
 * heading above it. AQA numbers some content a level deeper than a topic chooses to cite, so
 * a topic on the motor effect lists 4.7.2, which holds 4.7.2.1 to 4.7.2.4.
 */
export function covers(topicPoints: readonly string[], code: string): boolean {
  return topicPoints.some((p) => p === code || code.startsWith(`${p}.`))
}

export function specPoints(subjectId: string): SpecSection[] {
  return SPEC_POINTS[subjectId] ?? []
}

/**
 * The numbered sub-section a point sits in, for the headings inside a unit's card in the
 * specification's order: Physics and Chemistry's three-part numbers ("4.4.1 Reactivity of
 * metals"), and Business's topics ("1.4 Making the business effective") inside its themes.
 * Other subjects number straight from unit to point, so they have none.
 */
export function subsection(subjectId: string, code: string): { code: string; name: string } | undefined {
  const names = SUBSECTION_NAMES[subjectId]
    ?? (subjectId === 'business' ? Object.fromEntries(BUSINESS_POINTS.map((s) => [s.id, s.name.replace(/^\S+ /, '')])) : undefined)
  if (!names) return undefined
  const hit = Object.keys(names).filter((k) => covers([k], code)).sort((a, b) => b.length - a.length)[0]
  return hit ? { code: hit, name: names[hit]! } : undefined
}
