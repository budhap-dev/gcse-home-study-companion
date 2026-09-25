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
const business = jsonFiles(join(ROOT, 'business')).map((f) => ({
  file: f.split('/').pop()!,
  topic: Topic.parse(JSON.parse(readFileSync(f, 'utf8'))),
}))

/**
 * Edexcel 1BS0 marks its long questions in **three** levels, not four: a 12 marker runs
 * 1 to 4, 5 to 8, 9 to 12, and a 9 marker 1 to 3, 4 to 6, 7 to 9. Four levels is AQA.
 *
 * This is worth a test rather than a note because the mistake has already been made once
 * and half-corrected: the six written topics were rebuilt against Pearson's Summer 2024
 * mark scheme, in which "Level 4" appears nowhere, but the generator helper kept its
 * four-level grid and would have put the error straight back into the next topic. A
 * student revising to the wrong grid aims at a band that does not exist.
 */
describe('Edexcel Business levels', () => {
  const levelled = business.flatMap(({ file, topic }) =>
    topic.questions.filter((q) => q.marks === 9 || q.marks === 12).map((q) => ({ file, q })),
  )

  it('has levels-marked questions to check', () => {
    expect(levelled.length).toBeGreaterThan(5)
  })

  it('uses three levels, never four', () => {
    const bad = levelled
      .filter((x) => x.q.markScheme.length !== 3)
      .map((x) => `${x.file} ${x.q.id}: ${x.q.markScheme.length} levels`)
    expect(bad).toEqual([])
  })

  it('splits the marks evenly across the three levels', () => {
    const bad: string[] = []
    for (const { file, q } of levelled) {
      const each = q.marks / 3
      for (const line of q.markScheme) {
        if (line.marks !== each) bad.push(`${file} ${q.id}: a level worth ${line.marks}, expected ${each}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('names the bands Edexcel actually uses', () => {
    const bands: Record<number, string[]> = {
      9: ['Level 1 (1 to 3)', 'Level 2 (4 to 6)', 'Level 3 (7 to 9)'],
      12: ['Level 1 (1 to 4)', 'Level 2 (5 to 8)', 'Level 3 (9 to 12)'],
    }
    const bad: string[] = []
    for (const { file, q } of levelled) {
      q.markScheme.forEach((line, i) => {
        const expected = bands[q.marks][i]
        if (!line.description.startsWith(expected)) bad.push(`${file} ${q.id}: "${line.description.slice(0, 24)}…" should start "${expected}"`)
      })
    }
    expect(bad).toEqual([])
  })

  /** A "Level 4" anywhere in Business is the AQA grid leaking in. */
  it('never mentions a fourth level', () => {
    const bad = business
      .filter(({ topic }) => JSON.stringify(topic).includes('Level 4'))
      .map(({ file }) => file)
    expect(bad).toEqual([])
  })
})

const music = jsonFiles(join(ROOT, 'music')).map((f) => ({
  file: f.split('/').pop()!,
  topic: Topic.parse(JSON.parse(readFileSync(f, 'utf8'))),
}))

/**
 * Edexcel 1MU0 marks its 12-mark Section B comparison in **four** levels, 1 to 3, 4 to 6,
 * 7 to 9 and 10 to 12 (Summer 2022 Component 3 mark scheme). The level count belongs to
 * the specification, not the board: Business on the same board has three. Found in the
 * Music review pass on 25 September 2026, when two 12-mark essays were still marked as
 * twelve one-mark points, a grid Pearson does not use.
 */
describe('Edexcel Music levels', () => {
  const levelled = music.flatMap(({ file, topic }) => topic.questions.filter((q) => q.marks === 12).map((q) => ({ file, q })))

  it('has 12-mark questions to check', () => {
    expect(levelled.length).toBeGreaterThan(3)
  })

  it('marks every 12-mark question in the four bands Edexcel uses', () => {
    const bands = ['Level 1 (1 to 3)', 'Level 2 (4 to 6)', 'Level 3 (7 to 9)', 'Level 4 (10 to 12)']
    const bad: string[] = []
    for (const { file, q } of levelled) {
      if (q.markScheme.length !== 4) {
        bad.push(`${file} ${q.id}: ${q.markScheme.length} lines, expected four levels`)
        continue
      }
      q.markScheme.forEach((line, i) => {
        if (line.marks !== 3 || !line.description.startsWith(bands[i]!)) bad.push(`${file} ${q.id}: "${line.description.slice(0, 24)}…" should start "${bands[i]}" and be worth 3`)
      })
    }
    expect(bad).toEqual([])
  })
})
