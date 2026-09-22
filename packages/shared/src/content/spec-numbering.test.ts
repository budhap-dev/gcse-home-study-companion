import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Topic } from './topic.ts'

const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')
function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}
const topics = jsonFiles(ROOT).map((f) => Topic.parse(JSON.parse(readFileSync(f, 'utf8'))))

/**
 * Where a board numbers its content and the app's topics line up with those sections one
 * for one, the topic carries that number (`specCode`, "1.4") and each lesson step carries
 * the sub-point it teaches (`specPoint`, "1.4.2"). Edexcel Business is the case that has
 * it; other subjects' specification points do not divide up that way, so they have none.
 *
 * A number that has drifted from the content is worse than no number, because it is read
 * as a checklist against the syllabus. So the numbers are held to the points the topic
 * already declared rather than trusted on their own.
 */
describe('specification numbering', () => {
  it('gives every numbered topic a code that its own spec points sit under', () => {
    const bad: string[] = []
    for (const t of topics) {
      if (!t.specCode) continue
      for (const point of t.specPoints) {
        if (!point.startsWith(`${t.specCode}.`)) bad.push(`${t.id}: ${point} is not under ${t.specCode}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('never lets a step claim a point its topic does not cover', () => {
    const bad: string[] = []
    for (const t of topics) {
      for (const step of t.lesson.steps) {
        if (!step.specPoint) continue
        if (!t.specCode) bad.push(`${t.id} ${step.id}: a numbered step in an unnumbered topic`)
        else if (!t.specPoints.includes(step.specPoint)) {
          bad.push(`${t.id} ${step.id}: ${step.specPoint} is not one of ${t.specPoints.join(', ')}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  /**
   * The numbers are read as a checklist, so a sub-point with nothing teaching it is a
   * hole in the lesson that the numbering would otherwise hide.
   */
  it('teaches every sub-point of a numbered topic in at least one step', () => {
    const bad: string[] = []
    for (const t of topics) {
      if (!t.specCode) continue
      const taught = new Set(t.lesson.steps.map((s) => s.specPoint).filter(Boolean))
      const missing = t.specPoints.filter((p) => !taught.has(p))
      if (missing.length) bad.push(`${t.id}: nothing teaches ${missing.join(', ')}`)
    }
    expect(bad).toEqual([])
  })

  /** A lesson that jumps 1.4.3, 1.4.1, 1.4.3 reads as a mistake even when it is not. */
  it('runs the numbered steps in specification order', () => {
    const bad: string[] = []
    for (const t of topics) {
      const seen = t.lesson.steps.map((s) => s.specPoint).filter((p): p is string => Boolean(p))
      const sorted = [...seen].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
      if (seen.join(' ') !== sorted.join(' ')) bad.push(`${t.id}: ${seen.join(', ')}`)
    }
    expect(bad).toEqual([])
  })

  /** Business is the subject this was built for, so it has to be complete there. */
  it('numbers every Business topic and most of every Business lesson', () => {
    const business = topics.filter((t) => t.subjectId === 'business')
    expect(business.length).toBeGreaterThan(0)
    expect(business.filter((t) => t.specCode).map((t) => t.specCode).sort()).toEqual(
      ['1.1', '1.2', '1.3', '1.4', '1.5', '2.1', '2.2', '2.3', '2.4', '2.5'],
    )
    for (const t of business) {
      const numbered = t.lesson.steps.filter((s) => s.specPoint).length
      // The practice task, the grade 9 note and the summary each cover the whole topic
      // rather than one point, so they are the steps left unnumbered.
      expect(t.lesson.steps.length - numbered, `${t.id}`).toBeLessThanOrEqual(4)
    }
  })
})
