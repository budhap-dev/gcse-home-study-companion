import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SubjectGuide } from './topic.ts'

const ROOT = join(import.meta.dirname, '../../../../supabase/seed/guides')

describe('subject guides', () => {
  for (const name of readdirSync(ROOT).filter((n) => n.endsWith('.json'))) {
    it(`${name} matches the SubjectGuide schema`, () => {
      const parsed = SubjectGuide.safeParse(JSON.parse(readFileSync(join(ROOT, name), 'utf8')))
      expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues.slice(0, 3))).toBe(true)
      if (parsed.success) {
        expect(parsed.data.subjectId).toBe(name.replace('.json', ''))
        expect(parsed.data.assessmentObjectives.reduce((s, a) => s + a.weight, 0)).toBe(100)
      }
    })
  }
})
