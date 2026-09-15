import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SUBJECTS } from '../subjects.ts'

/**
 * Every topic names the specification unit it belongs to, and the subject page groups
 * topics under those units by looking the id up. An id that is not declared on the
 * subject silently drops out of that grouping — nothing throws, the topic just stops
 * appearing where it should. Three maths topics shipped with `ratio-and-proportion`,
 * which is the id of a *topic*, where the unit is `ratio-proportion-and-rates-of-change`.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')

const topics = readdirSync(ROOT)
  .filter((d) => statSync(join(ROOT, d)).isDirectory())
  .flatMap((d) =>
    readdirSync(join(ROOT, d))
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(ROOT, d, f), 'utf8')) as { id: string; subjectId: string; unitId: string }),
  )

describe('topic unit ids', () => {
  it('found the content pack', () => {
    expect(topics.length).toBeGreaterThan(50)
  })

  it('names a unit its own subject declares', () => {
    const unitsBySubject = new Map(SUBJECTS.map((s) => [s.id as string, new Set(s.units.map((u) => u.id))]))
    const bad = topics
      .filter((t) => !unitsBySubject.get(t.subjectId)?.has(t.unitId))
      .map((t) => `${t.subjectId}/${t.id}: ${t.unitId}`)
    expect(bad, `topics naming a unit their subject does not declare: ${bad.join(', ')}`).toEqual([])
  })

  it('would catch a unit id that belongs to another subject', () => {
    // The check is per subject, not a global set of every unit id in the app.
    const unitsBySubject = new Map(SUBJECTS.map((s) => [s.id as string, new Set(s.units.map((u) => u.id))]))
    expect(unitsBySubject.get('maths')?.has('algebra')).toBe(true)
    expect(unitsBySubject.get('physics')?.has('algebra')).toBe(false)
  })
})
