import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * How often the correct option is the only longest one.
 *
 * An author making the right answer complete and careful makes it longer than the rest, and
 * in 1750 of 4903 multiple-choice items (36%, and over half in Biology and Business) it was
 * the unique longest. With four options, "pick the longest" should be right a quarter of the
 * time at most; here it nearly doubled a guesser's score. Every question was right on its own,
 * so, like answer positions, the defect exists only in the collection.
 *
 * A student meets a topic's questions together, so the cap is per topic: at most 35% of its
 * single-answer items, bank and lesson checks together. Rebalancing on 26 September 2026 took
 * the pack from 36% to 24% in seven subject PRs (#285 to #292). Option sets that are all numbers are
 * left out, since their lengths come from the numbers.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')

const CAP = 0.35
/** Across the pack the share now sits near 24%, about chance for four options. */
const PACK_CAP = 0.3

interface Item { id: string; type?: string; options?: string[]; correct?: number[] }
interface Topic { id: string; subjectId: string; questions: Item[]; lesson: { steps: { check?: Item }[] } }

const topics: Topic[] = readdirSync(ROOT)
  .filter((d) => statSync(join(ROOT, d)).isDirectory())
  .flatMap((d) =>
    readdirSync(join(ROOT, d))
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(ROOT, d, f), 'utf8')) as Topic),
  )

/** Roughly the characters a student sees: a LaTeX command draws one symbol, markup draws none. */
function renderedLength(option: string): number {
  const s = option
    .replace(/\\(mathrm|text|textbf|mathbf|operatorname)\{([^}]*)\}/g, '$2')
    .replace(/\\(dfrac|frac|tfrac)\{([^}]*)\}\{([^}]*)\}/g, '$2/$3')
    .replace(/\\[a-zA-Z]+/g, 'x')
    .replace(/[$*_{}^]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return [...s].length
}

/** Every option a number, perhaps with a unit; 1 000 000 is written in groups of three. */
const numeric = (q: Item) => (q.options ?? []).every((o) => /^\s*[-+]?\d[\d.,]*(?:[  ]\d{3})*\s*[^\d]{0,12}$/.test(o.trim()))

const items = (t: Topic) =>
  [...t.questions, ...t.lesson.steps.flatMap((s) => (s.check ? [s.check] : []))].filter(
    (q) => q.type === 'multiple-choice' && q.options && q.correct?.length === 1 && !numeric(q),
  )

const correctIsLongest = (q: Item) => {
  const lengths = q.options!.map(renderedLength)
  const k = q.correct![0]!
  return lengths.every((l, i) => i === k || lengths[k]! > l)
}

describe('the correct option is not the tell', () => {
  it('found the content pack', () => {
    expect(topics.length).toBeGreaterThan(300)
    expect(topics.flatMap(items).length).toBeGreaterThan(4500)
  })

  it('is not the tell across the pack either', () => {
    const all = topics.flatMap(items)
    const longest = all.filter(correctIsLongest).length
    expect(longest / all.length).toBeLessThanOrEqual(PACK_CAP)
  })

  it('measures what is rendered, not the markup', () => {
    expect(renderedLength('**Kinetic** energy')).toBe(renderedLength('Kinetic energy'))
    expect(renderedLength('$\\dfrac{1}{2}mv^2$')).toBe('1/2mv2'.length)
    expect(renderedLength('$\\mathrm{H_2O}$')).toBe(3)
  })

  it.each(topics.map((t) => [`${t.subjectId}/${t.id}`, t] as const))(
    'is the only longest option in at most 35%% of %s',
    (_name, topic) => {
      const all = items(topic)
      const longest = all.filter(correctIsLongest).map((q) => q.id)
      // A topic with two or three items may have one: 1 of 2 is chance, not a habit.
      expect(longest.length, `${longest.length} of ${all.length}: ${longest.join(', ')}`).toBeLessThanOrEqual(Math.max(1, Math.floor(CAP * all.length)))
    },
  )
})
