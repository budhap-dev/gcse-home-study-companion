import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Topic } from './topic.ts'
import { compareSpecPoints, stepPoints, topicNumber } from './spec-number.ts'
import { INCIDENTAL_POINTS, UNTAUGHT_POINTS } from './spec-numbering.incidental.ts'

const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')
function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}
const topics = jsonFiles(ROOT).map((f) => Topic.parse(JSON.parse(readFileSync(f, 'utf8'))))

/**
 * Where a board numbers its content, a topic shows its number before its title and each
 * lesson step carries the point it teaches (`specPoint`, "1.4.2", "4.1.1.4", "G14"). For
 * Business the topic number is its section (`specCode`, "1.4"); elsewhere it is the
 * topic's own points, which `topicNumber` writes out. English, French and Music name
 * papers and themes rather than numbering their content, so they have none.
 *
 * A number that has drifted from the content is worse than no number, because it is read
 * as a checklist against the syllabus. So the numbers are held to the points the topic
 * already declared rather than trusted on their own.
 */
const NUMBERED_SUBJECTS = ['biology', 'business', 'chemistry', 'computer-science', 'further-maths', 'maths', 'physics']

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
        const points = stepPoints(step)
        if (!points.length) continue
        if (!topicNumber(t)) bad.push(`${t.id} ${step.id}: a numbered step in an unnumbered topic`)
        for (const p of points) {
          if (!t.specPoints.includes(p)) bad.push(`${t.id} ${step.id}: ${p} is not one of ${t.specPoints.join(', ')}`)
        }
        if (new Set(points).size !== points.length) bad.push(`${t.id} ${step.id}: ${points.join(', ')} repeats a point`)
        const sorted = [...points].sort(compareSpecPoints)
        if (points.length > 1 && sorted.join() !== points.join()) bad.push(`${t.id} ${step.id}: ${points.join(', ')} is out of order`)
      }
    }
    expect(bad).toEqual([])
  })

  /**
   * The numbers are read as a checklist, so a point with nothing teaching it is a hole in
   * the lesson that the numbering would otherwise hide. A few points a topic lists are
   * used in it rather than taught as a step's main content, and a few are not taught yet;
   * both are named, with where the lesson meets them, in spec-numbering.incidental.ts.
   */
  it('teaches every point of a numbered topic in at least one step', () => {
    const bad: string[] = []
    for (const t of topics) {
      if (!topicNumber(t)) continue
      const taught = new Set(t.lesson.steps.flatMap(stepPoints))
      const allowed = new Set([...Object.keys(INCIDENTAL_POINTS[t.id] ?? {}), ...Object.keys(UNTAUGHT_POINTS[t.id] ?? {})])
      const missing = t.specPoints.filter((p) => !taught.has(p) && !allowed.has(p))
      if (missing.length) bad.push(`${t.id}: nothing teaches ${missing.join(', ')}`)
    }
    expect(bad).toEqual([])
  })

  /** Once a step does teach an incidental point, the entry has to go, or the list rots. */
  it('lists as incidental or untaught only points that no step carries', () => {
    const byId = new Map(topics.map((t) => [t.id, t]))
    const stale: string[] = []
    for (const [id, points] of [...Object.entries(INCIDENTAL_POINTS), ...Object.entries(UNTAUGHT_POINTS)]) {
      const t = byId.get(id)
      if (!t) { stale.push(`${id}: no such topic`); continue }
      for (const p of Object.keys(points)) {
        if (!t.specPoints.includes(p)) stale.push(`${id}: ${p} is not one of its points`)
        else if (t.lesson.steps.some((s) => stepPoints(s).includes(p))) stale.push(`${id}: ${p} is now taught by a step`)
      }
    }
    expect(stale).toEqual([])
  })

  /**
   * A Business lesson works through its section point by point, so a jump such as 1.4.3,
   * 1.4.1, 1.4.3 there would read as a mistake. Other subjects' lessons are in teaching
   * order: a closing worked example often goes back to the first point, and the number
   * then says so truthfully. So the order is held for Business only.
   */
  it('runs the numbered steps of a Business lesson in specification order', () => {
    const bad: string[] = []
    for (const t of topics.filter((t) => t.subjectId === 'business')) {
      const seen = t.lesson.steps.flatMap(stepPoints)
      const sorted = [...seen].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
      if (seen.join(' ') !== sorted.join(' ')) bad.push(`${t.id}: ${seen.join(', ')}`)
    }
    expect(bad).toEqual([])
  })

  /** A new subject gets numbers by decision, and a numbered one cannot quietly lose them. */
  it('numbers exactly the subjects whose boards number their content', () => {
    const numbered = [...new Set(topics.filter((t) => topicNumber(t)).map((t) => t.subjectId))].sort()
    expect(numbered).toEqual(NUMBERED_SUBJECTS)
  })

  /**
   * The practice task and the summary cover a whole topic, and a teaching step that is an
   * introduction or exam technique has no point of its own. Anything more than the odd
   * teaching step unnumbered means the mapping was skipped, not judged. A grade 9 step is
   * numbered only where it is the one place a point is taught, which is worth seeing.
   */
  it('numbers nearly every teaching step of a numbered topic', () => {
    const bad: string[] = []
    let teaching = 0
    let numbered = 0
    for (const t of topics) {
      if (!topicNumber(t)) continue
      const steps = t.lesson.steps.filter((s) => s.kind === 'explain' || s.kind === 'worked-example')
      teaching += steps.length
      numbered += steps.filter((s) => stepPoints(s).length).length
      if (!steps.some((s) => stepPoints(s).length)) bad.push(`${t.id}: no step is numbered`)
      for (const s of t.lesson.steps) {
        if (stepPoints(s).length && (s.kind === 'your-turn' || s.kind === 'summary')) bad.push(`${t.id} ${s.id}: a ${s.kind} step is numbered`)
      }
      const taughtElsewhere = new Set(steps.flatMap(stepPoints))
      for (const s of t.lesson.steps.filter((s) => s.kind === 'grade-9')) {
        const again = stepPoints(s).filter((p) => taughtElsewhere.has(p))
        if (again.length) bad.push(`${t.id} ${s.id}: the grade 9 step claims ${again.join(', ')}, which a teaching step already has`)
      }
    }
    expect(bad).toEqual([])
    expect(numbered / teaching).toBeGreaterThan(0.95)
  })

  /** Business is the subject this was built for, so it has to be complete there. */
  it('numbers every Business topic and most of every Business lesson', () => {
    const business = topics.filter((t) => t.subjectId === 'business')
    expect(business.length).toBeGreaterThan(0)
    expect(business.filter((t) => t.specCode).map((t) => t.specCode).sort()).toEqual(
      ['1.1', '1.2', '1.3', '1.4', '1.5', '2.1', '2.2', '2.3', '2.4', '2.5'],
    )
    for (const t of business) {
      const numbered = t.lesson.steps.filter((s) => stepPoints(s).length).length
      // The practice task, the grade 9 note and the summary each cover the whole topic
      // rather than one point, so they are the steps left unnumbered.
      expect(t.lesson.steps.length - numbered, `${t.id}`).toBeLessThanOrEqual(4)
    }
  })
})
