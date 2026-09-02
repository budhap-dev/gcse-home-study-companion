import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateTopicForPublish } from './validate.ts'

const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return jsonFiles(full)
    return name.endsWith('.json') ? [full] : []
  })
}

describe('sample content pack', () => {
  const files = jsonFiles(ROOT)

  it('has at least one topic per Phase 1 subject', () => {
    expect(files.some((f) => f.includes('/maths/'))).toBe(true)
    expect(files.some((f) => f.includes('/physics/'))).toBe(true)
  })

  for (const file of files) {
    it(`${file.split('/content/')[1]} passes every publish rule except review`, () => {
      const topic = JSON.parse(readFileSync(file, 'utf8'))
      const issues = validateTopicForPublish(topic)
      const errors = issues.filter((i) => i.severity === 'error' && i.path !== 'provenance')
      expect(errors).toEqual([])
      // The pack is AI-drafted and unreviewed on purpose, so the review gate must fire.
      expect(issues).toContainEqual(expect.objectContaining({ path: 'provenance', severity: 'error' }))
    })
  }
})
