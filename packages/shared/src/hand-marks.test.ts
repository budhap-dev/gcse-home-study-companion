import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HAND_ANY, HAND_TAG } from './handMarks.ts'

/**
 * Hand-drawn marks in lesson text (section 15, Part C). A mark means "this one", so a step
 * holds at most two; only the three kinds exist; a mark never wraps display maths, which sits
 * on a line of its own and cannot be underlined or circled inline.
 */
const ROOT = join(import.meta.dirname, '../../../supabase/seed/content')
const steps = readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory()).flatMap((d) =>
  readdirSync(join(ROOT, d)).filter((f) => f.endsWith('.json')).flatMap((f) => {
    const t = JSON.parse(readFileSync(join(ROOT, d, f), 'utf8')) as { id: string; lesson: { steps: { id: string; body: string }[] } }
    return t.lesson.steps.map((s) => ({ where: `${d}/${t.id} ${s.id}`, body: s.body }))
  }))

describe('hand-drawn marks in lessons', () => {
  const marked = steps.filter((s) => s.body.includes('{{'))

  it('are used somewhere', () => {
    expect(marked.length).toBeGreaterThan(0)
  })

  it('are one of the three kinds, written in full', () => {
    for (const s of marked) {
      const any = [...s.body.matchAll(HAND_ANY)].length
      const good = [...s.body.matchAll(HAND_TAG)].length
      expect(good, s.where).toBe(any)
      expect(s.body.replace(HAND_TAG, '').includes('{{'), `${s.where}: a stray {{`).toBe(false)
    }
  })

  it('are at most two in a step', () => {
    for (const s of marked) expect([...s.body.matchAll(HAND_TAG)].length, s.where).toBeLessThanOrEqual(2)
  })

  it('never wrap display maths', () => {
    for (const s of marked) for (const m of s.body.matchAll(HAND_TAG)) expect(m[2]!.includes('$$'), s.where).toBe(false)
  })
})
