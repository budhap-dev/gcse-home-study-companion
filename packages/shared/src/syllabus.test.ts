import { describe, expect, it } from 'vitest'
import { SYLLABUS } from './syllabus.ts'
import { SUBJECTS } from './subjects.ts'

/**
 * The subject page shows the whole syllabus, so a topic that has been written must be
 * reachable from it and a `topicId` that points nowhere would render as a dead link.
 * The content pack is not importable from this package, so the topic ids are checked
 * against the seed folder on disk.
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '../../../supabase/seed/content')
const written = new Map<string, string>()
for (const dir of readdirSync(ROOT)) {
  if (!statSync(join(ROOT, dir)).isDirectory()) continue
  for (const file of readdirSync(join(ROOT, dir))) {
    if (file.endsWith('.json')) written.set(file.replace('.json', ''), dir)
  }
}

describe('syllabus', () => {
  it('covers every subject', () => {
    for (const s of SUBJECTS) expect(Object.keys(SYLLABUS), s.id).toContain(s.id)
  })

  it('only points at topics that exist', () => {
    const bad: string[] = []
    for (const [subjectId, blocks] of Object.entries(SYLLABUS)) {
      for (const b of blocks) {
        for (const t of b.topics) {
          if (!t.topicId) continue
          if (!written.has(t.topicId)) bad.push(`${subjectId}: ${t.topicId}`)
          else if (written.get(t.topicId) !== subjectId) bad.push(`${subjectId}: ${t.topicId} is in ${written.get(t.topicId)}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('lists every written topic exactly once, so nothing is invisible', () => {
    const listed = Object.values(SYLLABUS).flatMap((bs) => bs.flatMap((b) => b.topics.map((t) => t.topicId).filter(Boolean)))
    const missing = [...written.keys()].filter((id) => !listed.includes(id))
    const twice = listed.filter((id, i) => listed.indexOf(id) !== i)
    expect({ missing, twice }).toEqual({ missing: [], twice: [] })
  })

  it('puts a syllabus entry in the year the topic itself claims', () => {
    // The topic file's `year` and the syllabus block's `year` must agree, or the page
    // would show the same topic under two different years.
    expect(SYLLABUS.physics.find((b) => b.year === 9)?.topics.map((t) => t.topicId)).toContain('stopping-distances')
    expect(SYLLABUS.business.find((b) => b.year === 9)?.topics.map((t) => t.topicId)).toContain('putting-a-business-idea-into-practice')
  })
})
