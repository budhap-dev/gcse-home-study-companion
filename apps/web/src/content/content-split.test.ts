import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_TOPICS } from './all.ts'
import { TOPICS } from './index.ts'

// OPS-1 split the content: a small catalogue ships with the app and each topic's full
// content is fetched when it is opened. Two ways that could quietly go wrong are pinned here.
describe('content loaded on demand', () => {
  it('the app never imports every topic in full', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !p.endsWith(join('content', 'all.ts')) && /content\/all\.ts'/.test(readFileSync(p, 'utf8'))) offenders.push(p)
      }
    }
    walk(join(import.meta.dirname, '..'))
    expect(offenders).toEqual([])
  })

  it('the catalogue matches the full content, topic by topic', () => {
    expect(TOPICS.length).toBe(ALL_TOPICS.length)
    const full = new Map(ALL_TOPICS.map((t) => [t.id, t]))
    for (const s of TOPICS) {
      const t = full.get(s.id)!
      expect(s.title, s.id).toBe(t.title)
      expect(s.lesson.steps.map((x) => x.id), s.id).toEqual(t.lesson.steps.map((x) => x.id))
      expect(s.questions.map((q) => `${q.id}:${q.type}:${q.marks}:${q.skill}:${q.gradeBand}`), s.id).toEqual(t.questions.map((q) => `${q.id}:${q.type}:${q.marks}:${q.skill}:${q.gradeBand}`))
      expect(s.quiz, s.id).toEqual({ questionIds: t.quiz.questionIds, sampleSize: t.quiz.sampleSize })
    }
  })
})
