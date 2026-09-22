import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cheatSheetHasContent, cheatSheetOf, formulaeOf, keyPointsOf } from './cheatsheet.ts'
import { Topic } from './content/topic.ts'

const ROOT = join(import.meta.dirname, '../../../supabase/seed/content')

const topics = readdirSync(ROOT)
  .filter((d) => statSync(join(ROOT, d)).isDirectory())
  .flatMap((d) =>
    readdirSync(join(ROOT, d))
      .filter((f) => f.endsWith('.json'))
      .map((f) => Topic.parse(JSON.parse(readFileSync(join(ROOT, d, f), 'utf8')))),
  )

describe('the cheat sheet', () => {
  it('found the content pack', () => {
    expect(topics.length).toBeGreaterThan(200)
  })

  /**
   * The point of the sheet is that it needs no authoring. If it could come out empty for
   * some topic, it would need a fallback screen and a rule about when the tile appears,
   * and the feature would stop being free. So every topic in the pack must fill it.
   */
  it('has content for every topic in the pack', () => {
    const empty = topics.filter((t) => !cheatSheetHasContent(cheatSheetOf(t))).map((t) => t.id)
    expect(empty).toEqual([])
  })

  it('gives every topic key points and traps', () => {
    const thin = topics
      .map((t) => ({ id: t.id, sheet: cheatSheetOf(t) }))
      .filter(({ sheet }) => sheet.keyPoints.length < 3 || sheet.traps.length === 0)
      .map(({ id }) => id)
    expect(thin).toEqual([])
  })

  /**
   * The memory hooks are the reason the sheet leads with them rather than with the key
   * points. A pack where most topics had none would want a different first section.
   */
  it('gives most topics at least one memory hook', () => {
    const withHooks = topics.filter((t) => cheatSheetOf(t).memoryHooks.length > 0).length
    expect(withHooks / topics.length).toBeGreaterThan(0.9)
  })

  it('keeps a summary bullet whole rather than cutting it at its cue', () => {
    const topic = topics.find((t) => keyPointsOf(t).length > 0)!
    const summary = topic.lesson.steps.find((s) => s.kind === 'summary')!
    const first = summary.body.split('\n').map((l) => l.trim()).find((l) => l.startsWith('- '))!
    expect(keyPointsOf(topic)[0]).toBe(first.slice(2).trim())
  })

  it('takes no bullet from a step that is not the summary', () => {
    const topic = topics.find((t) => keyPointsOf(t).length > 0)!
    const summary = topic.lesson.steps.find((s) => s.kind === 'summary')!
    for (const point of keyPointsOf(topic)) expect(summary.body).toContain(point)
  })

  /** Equations are read out of the card's data, so they must survive as text. */
  it('reads equations off the equation cards', () => {
    const withFormulae = topics.filter((t) => formulaeOf(t).length > 0)
    expect(withFormulae.length).toBeGreaterThan(30)
    for (const topic of withFormulae) {
      for (const f of formulaeOf(topic)) {
        expect(f.equation.length).toBeGreaterThan(0)
        expect(f.equation).not.toContain('\n')
      }
    }
  })

  it('lists the same equation once', () => {
    for (const topic of topics) {
      const keys = formulaeOf(topic).map((f) => `${f.name}|${f.equation}`)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('puts every remember tip in the hooks and every other tip in the tactics', () => {
    for (const topic of topics) {
      const sheet = cheatSheetOf(topic)
      const tips = topic.tips ?? []
      expect(sheet.memoryHooks.length + sheet.tactics.length).toBe(tips.length)
      expect(sheet.memoryHooks.every((t) => t.kind === 'remember')).toBe(true)
      expect(sheet.tactics.every((t) => t.kind !== 'remember')).toBe(true)
    }
  })

  /**
   * A sheet that runs to several pages is a lesson, not a cheat sheet. This is a ceiling
   * on the source content as much as on the view: a topic whose summary runs to thirty
   * bullets has a summary problem.
   */
  it('stays short enough to be one sheet of paper', () => {
    const long = topics
      .map((t) => ({ id: t.id, sheet: cheatSheetOf(t) }))
      .map(({ id, sheet }) => ({
        id,
        words:
          sheet.keyPoints.join(' ').split(/\s+/).length +
          [...sheet.memoryHooks, ...sheet.tactics].map((t) => t.body).join(' ').split(/\s+/).length +
          sheet.traps.join(' ').split(/\s+/).length,
      }))
      .filter((r) => r.words > 1200)
    expect(long).toEqual([])
  })
})
