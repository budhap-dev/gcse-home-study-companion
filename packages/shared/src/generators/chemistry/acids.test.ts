import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { ACID_POOLS } from './acids.ts'

/**
 * Structural tests for the pH generators. Each reads the two pH values back from the prompt,
 * decides which solution has more hydrogen ions from the values alone, and checks the factor
 * is ten to the power of the change, never the change itself or ten times it; that the working
 * says so in the written slot's words; and that every framing rotates with the factors evenly
 * spread inside it.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/chemistry')
const bank = (topic: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions)

function build(generatorId: string, topic: string, slotId: string, count = 600): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  expect(g.topicId).toBe(topic)
  expect(g.replaces).toEqual([slotId])
  const slot = bank(topic).find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `structure-${i}`))
}

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const units = (b: Generated) => (b.question.type === 'numeric' ? b.question.units : 'not numeric')
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const codes = (b: Generated) => b.question.markScheme.map((l) => l.code)
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context))
const share = (xs: unknown[]) => {
  const counts = new Map<unknown, number>()
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1)
  return Math.max(...counts.values()) / xs.length
}
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five']

/** The two pH values a prompt prints, in order: "pH 3", "reads 4.6", "a pH of about 2". */
function readings(prompt: string): string[] {
  const xs = [...prompt.matchAll(/(?:pH(?: of(?: about)?)?|reads|falls to|from|and|to) (\d(?:\.\d)?)\b/g)].map((m) => m[1]!)
  return [...new Set(xs)]
}

/**
 * Every build: the factor read back from the prompt's own two values, the answer a power of ten
 * that is neither the change nor ten times it, whole-number changes, pH values of an acid or
 * water (0 to 7), and the meter readings to one place.
 */
function check(b: Generated, changes: number[], power = true) {
  expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
  expect(units(b)).toBeUndefined()
  expect(tolerance(b)).toBe(0)
  const xs = readings(b.question.prompt)
  expect(xs, b.question.prompt).toHaveLength(2)
  const [hi, lo] = xs.map(Number).sort((a, c) => c - a) as [number, number]
  expect(hi).toBe(b.values.high)
  expect(lo).toBe(b.values.low)
  expect(lo >= 0 && hi <= 7).toBe(true)
  const d = Math.round((hi - lo) * 10) / 10
  expect(Number.isInteger(d), b.question.prompt).toBe(true)
  expect(changes).toContain(d)
  expect(answer(b)).toBe(10 ** d)
  expect(answer(b)).not.toBe(d)
  expect(answer(b)).not.toBe(10 * d)
  // A meter reads to one place; an indicator or textbook value is whole.
  const meter = b.values.context === 'pH meter'
  for (const x of xs) expect(x.includes('.')).toBe(meter)
  if (meter) expect(xs.every((x) => !x.endsWith('.0'))).toBe(true)
  if (power) expect(b.question.solution).toContain(`$10^${d} = ${10 ** d}$`)
  expect(b.question.solution).toContain(String(answer(b)))
  expect(b.question.markScheme.at(-1)!.description).toBe(show(answer(b)))
  return { hi, lo, d, xs }
}
/** The framings rotate, and inside each the factor is drawn evenly. */
function spread(built: Generated[], framings: number, changes: number[]) {
  expect(contexts(built).size).toBe(framings)
  for (const name of contexts(built)) {
    const mine = built.filter((b) => b.values.context === name)
    expect(new Set(mine.map(answer)), String(name)).toEqual(new Set(changes.map((d) => 10 ** d)))
    expect(share(mine.map(answer)), String(name)).toBeLessThanOrEqual(changes.length === 3 ? 0.4 : 0.33)
  }
}

describe('strong and weak acids', () => {
  it('q6: a fall in pH multiplies the hydrogen ions by ten for each unit', () => {
    const built = build('ph-fall-factor', 'strong-and-weak-acids', 'q6')
    for (const b of built) {
      const { hi, lo, xs } = check(b, [2, 3, 4, 5])
      // The framing: the pH falls, from the higher value to the lower.
      expect(b.question.prompt.indexOf(xs.find((x) => Number(x) === hi)!)).toBeLessThan(b.question.prompt.lastIndexOf(xs.find((x) => Number(x) === lo)!))
      expect(b.question.prompt).toMatch(/falls/)
      expect(b.question.prompt).toMatch(/By what factor does the hydrogen ion concentration increase\?$/)
      expect(b.question.solution).toMatch(/fall of \d pH units/)
      expect(method(b)).toEqual(['uses ten to the power of the pH change'])
      expect(codes(b)).toEqual(['M1', 'A1'])
    }
    spread(built, 2, [2, 3, 4, 5])
  })

  it('q9: the solution with the lower pH has more hydrogen ions, by ten per unit', () => {
    const built = build('ph-compare-factor', 'strong-and-weak-acids', 'q9', 900)
    for (const b of built) {
      const { lo, d } = check(b, [2, 3, 4, 5])
      const p = b.question.prompt
      // The question asks about the solution with the lower pH, however it names it.
      if (b.values.context === 'two solutions') expect(p).toMatch(new RegExp(`in the pH ${show(lo)} solution\\?$`))
      if (b.values.context === 'pH meter') {
        const m = /reads (\S+) in solution (A|B) and (\S+) in solution (A|B)\. .* in solution (A|B)\?$/.exec(p)!
        expect(Number(m[1]) === lo ? m[2] : m[4]).toBe(m[5])
      }
      if (b.values.context === 'everyday liquids') {
        const liquid = ACID_POOLS.LIQUIDS.find((l) => l.pH === lo)!
        expect(p).toMatch(new RegExp(`in ${liquid.the}\\?$`))
        expect(p).toContain('Roughly')
        for (const l of ACID_POOLS.LIQUIDS) if (p.toLowerCase().includes(l.name.toLowerCase())) expect(p).toMatch(new RegExp(`${l.name} has a pH of (about )?${l.pH}\\b`, 'i'))
      }
      expect(b.question.solution).toMatch(new RegExp(`${WORDS[d]} pH units`, 'i'))
      expect(b.question.solution).toContain(`Not ${WORDS[d]} times`)
      expect(method(b)).toEqual([`identifies a change of ${WORDS[d]} pH units`])
    }
    spread(built, 3, [2, 3, 4, 5])
    // The higher pH comes first about half the time, as the written question has it.
    const first = built.filter((b) => b.values.context !== 'pH meter' && Number(readings(b.question.prompt)[0]) === b.values.high).length
    const n = built.filter((b) => b.values.context !== 'pH meter').length
    expect(first / n > 0.35 && first / n < 0.65).toBe(true)
  })

  it('q14: a strong acid below a weak one of the same concentration, the strong at pH 3 or lower and the weak at 5 or lower', () => {
    const built = build('ph-strong-weak-factor', 'strong-and-weak-acids', 'q14', 1500)
    for (const b of built) {
      const { hi, lo, d } = check(b, [2, 3, 4])
      const p = b.question.prompt
      expect(p).toContain('same concentration')
      // The weak acid has the higher pH.
      // The weak acid has the higher pH, in every wording.
      const [H, L] = b.values.context === 'pH meter' ? [hi.toFixed(1), lo.toFixed(1)] : [show(hi), show(lo)]
      expect(p.slice(0, p.indexOf('?') + 1)).toBeOneOf(
        b.values.context === 'pH meter'
          ? [
              `A pH meter reads ${H} in a weak acid and ${L} in a strong acid of the same concentration. By what factor is the hydrogen ion concentration greater in the strong acid?`,
              `A strong acid and a weak acid have the same concentration. A pH meter reads ${L} in the strong acid and ${H} in the weak acid. By what factor is the hydrogen ion concentration greater in the strong acid?`,
            ]
          : [
              `A weak acid at pH ${H} is replaced by a strong acid of the same concentration at pH ${L}. By what factor is the hydrogen ion concentration greater in the strong acid?`,
              `A student replaces a weak acid, pH ${H}, with a strong acid of the same concentration, pH ${L}. By what factor is the hydrogen ion concentration greater in the strong acid?`,
              `In an experiment, a weak acid at pH ${H} is swapped for a strong acid at pH ${L}, both at the same concentration. By what factor is the hydrogen ion concentration greater in the strong acid?`,
              `Two acids have the same concentration. The weak acid has pH ${H} and the strong acid has pH ${L}. How many times greater is the hydrogen ion concentration in the strong acid?`,
              `A strong acid and a weak acid have the same concentration. The strong acid has pH ${L} and the weak acid has pH ${H}. How many times greater is the hydrogen ion concentration in the strong acid?`,
              `Solutions of a weak acid and a strong acid are made at the same concentration. The weak acid has pH ${H}; the strong acid has pH ${L}. How many times greater is the hydrogen ion concentration in the strong acid?`,
            ],
      )
      // The strong acid at pH 3 or below, the weak acid at pH 5 or below, as in the written slot.
      expect(lo).toBeLessThanOrEqual(3)
      expect(hi).toBeLessThanOrEqual(5)
      expect(b.question.solution).toContain(`A difference of ${d} pH units`)
      expect(b.question.solution).toContain(`${WORDS[d]} units on the scale is a`)
      expect(method(b)).toEqual([`finds the pH difference of ${d}`, 'raises ten to that power'])
      expect(codes(b)).toEqual(['M1', 'M1', 'A1'])
    }
    spread(built, 3, [2, 3, 4])
  })
})

describe('carboxylic acids and esters', () => {
  it('q13: ten per pH unit, with ethanoic acid always the weaker', () => {
    const built = build('ph-weak-acid-factor', 'carboxylic-acids-and-esters', 'q13', 900)
    for (const b of built) {
      const { hi, lo, d } = check(b, [2, 3, 4, 5], false)
      const p = b.question.prompt
      if (b.values.context === 'ethanoic and hydrochloric acid') {
        expect(p).toContain(`ethanoic acid has pH ${show(hi)}`)
        expect(p).toContain(`hydrochloric acid has pH ${show(lo)}`)
        expect(hi >= 3 && hi <= 5 && lo <= 2).toBe(true)
        expect(p).toMatch(/in the hydrochloric acid\?$/)
      } else expect(p).toMatch(new RegExp(`(pH ${show(lo)} solution|at pH ${lo.toFixed(1)})\\?$`))
      expect(b.question.solution).toMatch(new RegExp(`${WORDS[d]} pH units, each a factor of 10: \\*\\*${10 ** d}\\*\\* times\\.$`, 'i'))
      expect(method(b)).toEqual(['a factor of 10 per pH unit'])
    }
    spread(built, 3, [2, 3, 4, 5])
  })
})

describe('the pairs', () => {
  it('every framing has a pair for every change it names, and a meter pair shares its tenths', () => {
    for (const f of [...ACID_POOLS.FALLS, ...ACID_POOLS.COMPARED, ...ACID_POOLS.STRENGTHS, ...ACID_POOLS.WEAK]) {
      const all = ACID_POOLS.framed(f)
      expect(new Set(all.map((p) => p.d))).toEqual(new Set(f.changes))
      for (const p of all) {
        expect(Number.isInteger(Math.round((p.high - p.low) * 10) / 10)).toBe(true)
        if (f.dp) expect(Number.isInteger(p.low)).toBe(false)
      }
    }
  })
})
