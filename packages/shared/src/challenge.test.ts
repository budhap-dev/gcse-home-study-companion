import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Challenge problems (backlog section 13, box 12): problems that need topics from more than
 * one unit of a subject at once, shown as the subject's Challenge set. Each lives in one topic
 * and names the others it draws on; these hold that the others exist, that at least one is in
 * another unit (otherwise it is a unit's own grade 9 problem), and how many each subject has.
 */
type Q = { id: string; gradeBand: string; discriminators?: string[]; context?: string; challenge?: { draws: string[] } }
type T = { id: string; unitId: string; questions: Q[]; worksheets: Record<string, { questionIds: string[] }>; quiz: { questionIds: string[] } }

const ROOT = new URL('../../../supabase/seed/content/', import.meta.url)
function topics(subject: string): T[] {
  return readdirSync(new URL(`${subject}/`, ROOT)).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(new URL(`${subject}/${f}`, ROOT), 'utf8')) as T)
}

/** Problems per subject: a multi-part problem counts once. Ten to twenty each, as box 12 plans. */
const COUNTS: Record<string, number> = { maths: 12 }

describe('Challenge problems', () => {
  for (const [subject, count] of Object.entries(COUNTS)) {
    const ts = topics(subject)
    const unitOf = new Map(ts.map((t) => [t.id, t.unitId]))
    const problems = new Map<string, { topic: T; parts: Q[] }>()
    for (const t of ts) for (const q of t.questions) {
      if (!q.challenge) continue
      const key = `${t.id}/${q.context ?? q.id}`
      problems.set(key, { topic: t, parts: [...(problems.get(key)?.parts ?? []), q] })
    }

    it(`${subject}: has ${count}, between ten and twenty`, () => {
      expect(problems.size).toBe(count)
      expect(count).toBeGreaterThanOrEqual(10)
      expect(count).toBeLessThanOrEqual(20)
    })

    it(`${subject}: each draws on real topics, at least one in another unit`, () => {
      for (const [key, { topic, parts }] of problems) {
        const draws = parts[0]!.challenge!.draws
        for (const p of parts) expect(p.challenge!.draws, `${key} ${p.id}: every part names the same topics`).toEqual(draws)
        for (const d of draws) expect(unitOf.has(d), `${key}: ${d} is not a ${subject} topic`).toBe(true)
        expect(draws.some((d) => unitOf.get(d) !== topic.unitId), `${key}: draws only on its own unit`).toBe(true)
        expect(draws).not.toContain(topic.id)
      }
    })

    it(`${subject}: each is a grade 8 to 9 problem that says it crosses topics`, () => {
      for (const [key, { parts }] of problems) {
        expect(parts.some((p) => p.gradeBand === '8-9' && p.discriminators?.includes('multi-topic')), key).toBe(true)
      }
    })

    it(`${subject}: a multi-part problem is a Challenge problem in every part`, () => {
      for (const t of ts) for (const q of t.questions) {
        if (!q.context || !problems.has(`${t.id}/${q.context}`)) continue
        expect(q.challenge, `${t.id} ${q.id}`).toBeDefined()
      }
    })

    it(`${subject}: none sits on a topic's worksheets or quiz, which keep to the topic`, () => {
      for (const { topic, parts } of problems.values()) {
        const on = new Set([...Object.values(topic.worksheets).flatMap((w) => w.questionIds), ...topic.quiz.questionIds])
        for (const p of parts) expect(on.has(p.id), `${topic.id} ${p.id}`).toBe(false)
      }
    })
  }
})
