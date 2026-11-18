import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Topic } from './topic.ts'
import { covers, NO_TOPIC, SPEC_POINTS } from '../specPoints/index.ts'
import { parseSpecPoint } from './spec-number.ts'

const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')
function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}
const topics = jsonFiles(ROOT).map((f) => Topic.parse(JSON.parse(readFileSync(f, 'utf8'))))

/**
 * The specification checklist is read as the board's own list, so it is held to the topics
 * both ways: a topic may only name a point the board has, and a point no topic names must
 * say why.
 */
describe.each(Object.keys(SPEC_POINTS))('specification points: %s', (subjectId) => {
  const codes = SPEC_POINTS[subjectId]!.flatMap((s) => s.points.map((p) => p.code))
  const mine = topics.filter((t) => t.subjectId === subjectId)

  it('lists each point once, with its words', () => {
    expect(new Set(codes).size).toBe(codes.length)
    for (const s of SPEC_POINTS[subjectId]!) for (const p of s.points) expect(p.text.trim().length, p.code).toBeGreaterThan(3)
  })

  // A bridging topic's points describe Year 9 work in words; only numbered points are checked.
  it('knows every point a topic names, or the heading above some', () => {
    const unknown = mine.flatMap((t) => t.specPoints.filter((p) => parseSpecPoint(p) && !codes.some((c) => covers([p], c))).map((p) => `${t.id}: ${p}`))
    expect(unknown).toEqual([])
  })

  it('has a topic for every point, or says why not', () => {
    const named = mine.flatMap((t) => t.specPoints)
    const missing = codes.filter((c) => !covers(named, c) && !NO_TOPIC[subjectId]?.[c])
    expect(missing).toEqual([])
    const stale = Object.keys(NO_TOPIC[subjectId] ?? {}).filter((c) => covers(named, c) || !codes.includes(c))
    expect(stale, 'reasons for points that now have a topic, or are not points').toEqual([])
  })
})
