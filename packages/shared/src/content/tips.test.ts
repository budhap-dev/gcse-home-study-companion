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
const topics = jsonFiles(ROOT).map((f) => ({ file: f.split('/').pop()!, topic: Topic.parse(JSON.parse(readFileSync(f, 'utf8'))) }))

/**
 * Tips are what a student rereads in the minute before a test, so each one has to be
 * short, specific and actually usable. They are not a second examiner-errors list:
 * those say what goes wrong, these say what to do.
 */
describe('tips and tricks', () => {
  it('gives every tip a title and a body worth reading', () => {
    for (const { file, topic } of topics) {
      for (const tip of topic.tips ?? []) {
        expect(tip.title.length, `${file}: ${tip.title}`).toBeGreaterThan(8)
        expect(tip.body.length, `${file}: ${tip.title}`).toBeGreaterThan(60)
      }
    }
  })

  it('keeps a tip short enough to reread quickly', () => {
    for (const { file, topic } of topics) {
      for (const tip of topic.tips ?? []) {
        expect(tip.body.length, `${file}: ${tip.title}`).toBeLessThanOrEqual(420)
      }
    }
  })

  it('never repeats a tip title within a topic', () => {
    for (const { file, topic } of topics) {
      const titles = (topic.tips ?? []).map((t) => t.title.toLowerCase())
      expect(new Set(titles).size, file).toBe(titles.length)
    }
  })

  it('covers more than one kind when a topic has several tips', () => {
    // Four tips that all say "remember this" would be a list, not a toolkit.
    for (const { file, topic } of topics) {
      const tips = topic.tips ?? []
      if (tips.length < 3) continue
      expect(new Set(tips.map((t) => t.kind)).size, file).toBeGreaterThan(1)
    }
  })
})
