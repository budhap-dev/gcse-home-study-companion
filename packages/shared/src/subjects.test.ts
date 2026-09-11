import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SUBJECTS } from './subjects.ts'

const SEED = join(import.meta.dirname, '../../../supabase/seed.sql')

/**
 * The unit list exists twice: as `SUBJECTS` here, which the app renders from, and as rows
 * in supabase/seed.sql, which the database's foreign key checks topics against. Changing
 * one and not the other passes every local check and then fails the import in CI, which
 * is exactly what happened when Music moved to Edexcel's four areas of study.
 */
describe('subjects and the database seed agree', () => {
  const sql = readFileSync(SEED, 'utf8')
  // ('subject-id', 'unit-id', 'Name', sort)
  const rows = [...sql.matchAll(/\('([a-z0-9-]+)',\s*'([a-z0-9-]+)',\s*'((?:[^']|'')*)',\s*(\d+)\)/g)]
  const seeded = new Map<string, { name: string; sort: number }>()
  for (const [, subjectId, unitId, name, sort] of rows) {
    seeded.set(`${subjectId}/${unitId}`, { name: name!.replace(/''/g, "'"), sort: Number(sort) })
  }

  it('found unit rows to check', () => {
    expect(seeded.size).toBeGreaterThan(30)
  })

  it('seeds exactly the units the app defines, with the same names and order', () => {
    const problems: string[] = []
    const expected = new Set<string>()
    for (const subject of SUBJECTS) {
      subject.units.forEach((unit, i) => {
        const key = `${subject.id}/${unit.id}`
        expected.add(key)
        const row = seeded.get(key)
        if (!row) problems.push(`${key} is in subjects.ts but not seeded`)
        else {
          if (row.name !== unit.name) problems.push(`${key} name: seed has "${row.name}", app has "${unit.name}"`)
          if (row.sort !== i + 1) problems.push(`${key} sort: seed has ${row.sort}, app has it at position ${i + 1}`)
        }
      })
    }
    for (const key of seeded.keys()) {
      if (!expected.has(key)) problems.push(`${key} is seeded but no longer in subjects.ts`)
    }
    expect(problems).toEqual([])
  })
})
