import { describe, expect, it } from 'vitest'
import { TOPICS } from './index.ts'
import { teachingStep } from './teachingStep.ts'

// A missed quiz question links to the lesson step that teaches it. A link to the wrong step
// is worse than a link to the start, so the word rule is measured against the questions
// the skill rule can place, and must mostly agree with it.
describe('the lesson step that teaches a question', () => {
  let known = 0, answered = 0, agree = 0, placed = 0, total = 0
  for (const t of TOPICS) for (const q of t.questions) {
    total++
    const bySkill = t.lesson.steps.findIndex((s) => s.check?.skill?.trim().toLowerCase() === q.skill.trim().toLowerCase())
    const byWords = teachingStep(t, q, { bySkill: false })
    if (teachingStep(t, q) !== undefined) placed++
    if (bySkill >= 0) { known++; if (byWords !== undefined) { answered++; if (byWords === bySkill) agree++ } }
  }

  it('the word rule agrees with the skill rule at least 80% of the time', () => {
    expect(answered).toBeGreaterThan(500)
    expect(agree / answered).toBeGreaterThanOrEqual(0.8)
  })

  it('places most questions', () => {
    expect(known).toBeGreaterThan(3000)
    expect(placed / total).toBeGreaterThanOrEqual(0.6)
  })

  it('never points at the summary step', () => {
    for (const t of TOPICS) for (const q of t.questions) {
      const i = teachingStep(t, q, { bySkill: false })
      if (i !== undefined) expect(t.lesson.steps[i]!.kind).not.toBe('summary')
    }
  })
})
