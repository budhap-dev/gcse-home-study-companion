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
 * single-answer items, bank and lesson checks together. Option sets that are all numbers are
 * left out, since their lengths come from the numbers.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')

/** Subjects rebalanced so far. Each subject's PR adds itself; the last one removes the list. */
const ENFORCED = new Set(['business', 'english-language', 'english-literature', 'further-maths', 'music'])
const CAP = 0.35

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

const numeric = (q: Item) => (q.options ?? []).every((o) => /^\s*[-+]?\d[\d.,]*\s*[^\d]{0,12}$/.test(o.trim()))

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

  it('measures what is rendered, not the markup', () => {
    expect(renderedLength('**Kinetic** energy')).toBe(renderedLength('Kinetic energy'))
    expect(renderedLength('$\\dfrac{1}{2}mv^2$')).toBe('1/2mv2'.length)
    expect(renderedLength('$\\mathrm{H_2O}$')).toBe(3)
  })

  it.each(topics.filter((t) => ENFORCED.has(t.subjectId)).map((t) => [`${t.subjectId}/${t.id}`, t] as const))(
    'is the only longest option in at most 35%% of %s',
    (_name, topic) => {
      const all = items(topic)
      const longest = all.filter(correctIsLongest).map((q) => q.id)
      expect(longest.length, `${longest.length} of ${all.length}: ${longest.join(', ')}`).toBeLessThanOrEqual(Math.floor(CAP * all.length))
    },
  )
})
