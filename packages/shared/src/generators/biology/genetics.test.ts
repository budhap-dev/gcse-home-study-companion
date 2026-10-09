import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import {
  AUTOSOMAL,
  COLOUR_BLINDNESS,
  DUCHENNE,
  geneticsGenerators,
  HAEMOPHILIA,
  LINKED,
  PLANT_TRAITS,
  SEX_LINKED,
  STRETCHES,
  TRAITS,
  type Linked,
} from './genetics.ts'
import { ANIMALS, PLANTS } from './microscopy.ts'

/**
 * Structural tests for the genetics generators. Each reads the prompt's own figures and words
 * back (the bases, the base pairs, the parents' genotypes, the family table, the time and the
 * start), works the answer again with plain arithmetic or its own Punnett square, never the
 * generator's helpers, and checks every printed step: the doubled base pairs, the halved total,
 * the square, the boxes counted over the denominator asked. Across builds they check every
 * context turns up, every figure is real for what is named, no answer or input fills a context,
 * and a choice the student makes (dominant or recessive, carrier or not, boy or girl) goes each
 * way about half the time. Some builds are checked as literal text.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/biology')
const bankOf = (topic: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bankOf(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `${prefix}-${i}`))
}

const c = (x: number) => Number(x.toPrecision(12))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const units = (b: Generated) => (b.question.type === 'numeric' ? b.question.units : undefined)
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const sigFigures = (x: number) => String(c(x)).replace('.', '').replace(/^0+/, '').replace(/0+$/, '').length
const decimals = (x: number) => (String(c(x)).split('.')[1] ?? '').length
/** A number from the prompt, read with its spaced thousands: "14 000" is 14000. */
const num = (re: RegExp, s: string) => {
  const m = re.exec(s)
  if (!m) throw new Error(`${re} not in: ${s}`)
  return Number(m[1]!.replace(/ /g, ''))
}
const word = (re: RegExp, s: string) => {
  const m = re.exec(s)
  if (!m) throw new Error(`${re} not in: ${s}`)
  return m[1]!
}
/** In maths, from five digits a thin space between thousands: 14\\,000. */
const texed = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : String(x))
/** In prose, from five digits a space between thousands: 14 000. */
const spaced = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(x))
/** Half a unit in the last place of an exact answer (capped at 1.9%), none for a whole number. */
const exactTol = (x: number) => (decimals(x) ? c(Math.min(0.5 * 10 ** -decimals(x), Math.abs(x) * 0.019)) : 0)
const share = (built: Generated[], pred: (b: Generated) => boolean) => built.filter(pred).length / built.length

function worstShare(built: Generated[], key: (b: Generated) => unknown) {
  const by = new Map<unknown, Generated[]>()
  for (const b of built) by.set(b.values.context, [...(by.get(b.values.context) ?? []), b])
  let worst = 0
  let fewest = Infinity
  for (const group of by.values()) {
    const counts = new Map<unknown, number>()
    for (const b of group) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
    worst = Math.max(worst, Math.max(...counts.values()) / group.length)
    fewest = Math.min(fewest, counts.size)
  }
  return { worst, fewest }
}
/** No answer, nor any listed input, over 40% of a context's builds; at least `fewest` answers in each. */
function spread(id: string, slot: string, keys: string[], fewest = 10) {
  const many = build(id, slot, 2000, 'spread')
  const a = worstShare(many, answer)
  expect(a.worst, `${id} ${slot} answer`).toBeLessThanOrEqual(0.4)
  expect(a.fewest, `${id} ${slot} answers per context`).toBeGreaterThanOrEqual(fewest)
  for (const k of keys) expect(worstShare(many, (b) => b.values[k]).worst, `${id} ${slot} ${k}`).toBeLessThanOrEqual(0.4)
  return many
}

const SLOTS = [
  ...['q6', 'q11', 'q24', 'q25'].map((q) => `dna-chromosomes-and-genes/${q}`),
  ...['q6', 'q26', 'q27'].map((q) => `dna-genes-and-protein-synthesis/${q}`),
  ...['q5', 'q7', 'q14', 'q19', 'q20', 'q27'].map((q) => `genetic-disorders-and-screening/${q}`),
  ...['q5', 'q19', 'q20', 'q26', 'q27'].map((q) => `inheritance-and-genetic-diagrams/${q}`),
  ...['q4', 'q9', 'q25'].map((q) => `meiosis-and-sexual-reproduction/${q}`),
]

describe('every genetics build', () => {
  it('has a generator for each numeric written slot it can vary, and leaves the six others written', () => {
    const claimed = geneticsGenerators.flatMap((g) => g.replaces.map((id) => `${g.topicId}/${id}`)).sort()
    expect(claimed).toEqual([...SLOTS].sort())
    // Recall (23 pairs, 3 bases, 4 cells), always 50% (a girl), or too few real versions (ten pairs of parents, a dozen hybrids).
    const left = ['dna-chromosomes-and-genes/q2', 'dna-genes-and-protein-synthesis/q4', 'genetic-disorders-and-screening/q26', 'inheritance-and-genetic-diagrams/q7', 'meiosis-and-sexual-reproduction/q1', 'meiosis-and-sexual-reproduction/q24']
    for (const s of left) expect(claimed).not.toContain(s)
  })

  it('prints no article before a figure, keeps the written units, reaches its answer, and is marked right with it', () => {
    for (const g of geneticsGenerators) {
      for (const id of g.replaces) {
        const slot = bankOf(g.topicId).find((q) => q.id === id)!
        for (const b of build(g.id, id, 150)) {
          expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          expect(b.question.prompt, b.seed).not.toMatch(/expected to not/)
          expect(units(b), `${g.id} ${id}`).toBe(slot.type === 'numeric' ? slot.units : undefined)
          expect(b.question.solution, b.seed).toContain(String(answer(b)))
          expect(mark(b.question, String(answer(b))).correct, b.seed).toBe(true)
          // Every answer is exact: a count, a share of boxes or a percentage that ends within three figures.
          expect(Number(answer(b).toPrecision(3)), b.seed).toBe(answer(b))
          expect(tolerance(b), b.seed).toBeLessThanOrEqual(Math.abs(answer(b)) * 0.02)
          expect(b.check.agrees, b.seed).toBe(true)
          expect(answer(b), b.seed).toBeGreaterThan(0)
        }
        expect(new Set(build(g.id, id, 1000, 'variety').map((b) => b.question.prompt)).size, `${g.id} ${id}`).toBeGreaterThan(100)
      }
    }
  })

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const g of geneticsGenerators) {
      for (const s of g.replaces) {
        const slot = bankOf(g.topicId).find((q) => q.id === s)!
        expect(() => {
          for (let i = 0; i < 3000; i++) generate(g, slot, `throw-${i}`)
        }, `${g.id} ${s}`).not.toThrow()
      }
    }
  }, 120_000)
})

// =============================================================================================
// Bases
// =============================================================================================

const PAIRS: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' }
/** The given base and its share, and the base asked for (the last in the prompt), read from any wording. */
function bases(p: string) {
  const m = /(\d+)%[^A-Z]*?([ATCG])\b/.exec(p)
  if (!m) throw new Error(`no base in: ${p}`)
  return { pct: Number(m[1]), x: m[2]!, z: word(/([ATCG])\)?[?.]$/, p) }
}

describe('base pairing', () => {
  it('DNA q6: the partner base has the same share, 13 to 37% and never 25%', () => {
    const built = build('dna-partner-base-percentage', 'q6')
    for (const b of built) {
      const { pct, x, z } = bases(b.question.prompt)
      expect(z).toBe(PAIRS[x])
      expect(answer(b)).toBe(pct)
      expect(pct).toBeGreaterThanOrEqual(13)
      expect(pct).toBeLessThanOrEqual(37)
      expect(pct).not.toBe(25)
      expect(b.question.solution).toContain(`${x} pairs with ${z}, so the amounts are equal: **${pct}%** ${z}. The other $100 - ${pct} - ${pct} = ${100 - 2 * pct}\\%$`)
      expect(b.question.solution).toContain(`, ${50 - pct}% each.`)
      expect(tolerance(b)).toBe(0)
    }
    expect(contexts(built)).toBe(4)
    spread('dna-partner-base-percentage', 'q6', ['given'])
  })

  it('DNA q6: literal working for 24% T', () => {
    const b = build('dna-partner-base-percentage', 'q6', 3000, 'find').find((y) => y.values.given === 24 && y.values.context === 'T')!
    expect(b.question.solution).toBe('T pairs with A, so the amounts are equal: **24%** A. The other $100 - 24 - 24 = 52\\%$ is C and G, 26% each.')
  })

  for (const [id, slot, long] of [
    ['dna-other-pair-percentage', 'q11', false],
    ['protein-other-pair-percentage', 'q26', true],
  ] as const) {
    it(`${slot}: the other pair shares what is left, (100 − 2 × share) ÷ 2`, () => {
      const built = build(id, slot)
      for (const b of built) {
        const p = b.question.prompt
        const { pct, x, z } = bases(p)
        const y = PAIRS[x]!
        // The base asked for is in the other pair, never the given one or its partner.
        expect([x, y]).not.toContain(z)
        const ans = (100 - 2 * pct) / 2
        expect(answer(b)).toBe(ans)
        expect(ans).not.toBe(pct)
        expect(b.question.solution).toContain(`$${pct} + ${pct} = ${2 * pct}\\%$`)
        expect(b.question.solution).toContain(`$100 - ${2 * pct} = ${100 - 2 * pct}\\%$`)
        expect(b.question.solution).toContain(`$${100 - 2 * pct} \\div 2 = ${ans}\\%$`)
        expect(b.question.solution).toContain(`Check: $${pct} + ${pct} + ${ans} + ${ans} = 100$.`)
        if (long) {
          expect(p).toContain('In DNA, adenine (A) pairs with thymine (T), and cytosine (C) pairs with guanine (G).')
          expect(p).toMatch(/^(In a sample|A sample of DNA is analysed)/)
          expect(method(b)[0]).toMatch(new RegExp(`^uses complementary pairing: \\w+ is also ${pct}%, so \\w+ and \\w+ together are ${100 - 2 * pct}%$`))
        } else expect(method(b)).toEqual([`${x} + ${y} = ${2 * pct}%`])
      }
      expect(contexts(built)).toBe(4)
      const many = spread(id, slot, ['given'])
      // Both bases of the other pair are asked about, about half each.
      const first = share(many, (b) => ['C', 'A'].includes(b.values.asked as string))
      expect(first).toBeGreaterThan(0.4)
      expect(first).toBeLessThan(0.6)
    })
  }

  it('DNA q11: literal working for 24% T, asking G', () => {
    const b = build('dna-other-pair-percentage', 'q11', 3000, 'find').find((y) => y.values.given === 24 && y.values.context === 'T' && y.values.asked === 'G')!
    expect(b.question.solution).toBe(
      'T pairs with A, so A is also **24%**, and the two together are $24 + 24 = 48\\%$. The remaining $100 - 48 = 52\\%$ is C and G, which pair with each other, so they are equal: $52 \\div 2 = 26\\%$ G. Check: $24 + 24 + 26 + 26 = 100$.',
    )
    expect(answer(b)).toBe(26)
  })
})

describe("a gene's share of its molecule", () => {
  it('DNA q24: gene ÷ molecule × 100, exact, with real lengths for a plasmid, a virus and a chromosome', () => {
    const built = build('gene-percentage-of-a-dna-molecule', 'q24')
    const limits: Record<string, [number, number, number, number]> = { plasmid: [600, 1500, 2000, 60000], virus: [400, 3000, 30000, 170000], chromosome: [1000, 30000, 20000, 400000] }
    for (const b of built) {
      const p = b.question.prompt
      // The molecule's length comes first in every wording, the gene's second.
      const [L, g] = [...p.matchAll(/(\d+(?: \d{3})*) base pairs long/g)].map((m) => Number(m[1]!.replace(/ /g, '')))
      if (L === undefined || g === undefined) throw new Error(p)
      const [g0, g1, L0, L1] = limits[b.values.context as string]!
      expect(g).toBeGreaterThanOrEqual(g0)
      expect(g).toBeLessThanOrEqual(g1)
      expect(L).toBeGreaterThanOrEqual(L0)
      expect(L).toBeLessThanOrEqual(L1)
      const exact = c((100 * g) / L)
      expect(answer(b)).toBe(exact)
      expect(sigFigures(exact)).toBeLessThanOrEqual(3)
      expect(exact).toBeGreaterThanOrEqual(0.5)
      expect(exact).toBeLessThanOrEqual(40)
      expect(tolerance(b)).toBe(exactTol(exact))
      expect(b.question.solution).toContain(`$\\dfrac{${texed(g)}}{${texed(L)}} \\times 100 = ${exact}$%.`)
      expect(method(b)).toEqual([`divides ${spaced(g)} by ${spaced(L)} and multiplies by 100`])
      expect(units(b)).toBe('%')
      // Forgetting the × 100 is marked wrong.
      expect(mark(b.question, String(c(g / L))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(STRETCHES.length)
    spread('gene-percentage-of-a-dna-molecule', 'q24', ['gene', 'length'])
  })
})

describe('counting bases', () => {
  it('DNA q25: double the base pairs, take the given pair, halve the rest', () => {
    const built = build('dna-base-count-from-base-pairs', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const N = num(/(\d+(?: \d{3})*) base pairs/, p)
      const pct = num(/(\d+)% (?:of all its bases )?are/, p)
      const x = word(/\d+% (?:of all its bases )?are ([ATCG])\b/, p)
      const z = word(/number of ([ATCG]) bases/, p)
      const y = PAIRS[x]!
      expect([x, y]).not.toContain(z)
      const total = 2 * N
      const given = (total * pct) / 100
      const ans = (total - 2 * given) / 2
      expect(Number.isInteger(given)).toBe(true)
      expect(answer(b)).toBe(ans)
      expect(sigFigures(ans)).toBeLessThanOrEqual(3)
      expect(tolerance(b)).toBe(0)
      expect(b.question.solution).toContain(`$2 \\times ${texed(N)} = ${texed(total)}$ bases`)
      expect(b.question.solution).toContain(`${pct}% of ${spaced(total)} is ${spaced(given)} ${x} and ${spaced(given)} ${y}, which is ${spaced(2 * given)} together.`)
      expect(b.question.solution).toContain(`$${texed(total)} - ${texed(2 * given)} = ${texed(total - 2 * given)}$ bases`)
      expect(method(b)).toEqual([`doubles the base pairs to ${spaced(total)} bases`, `${x} = ${y} = ${spaced(given)}, so ${['A', 'T'].includes(z) ? 'A and T' : 'C and G'} share the remaining ${spaced(total - 2 * given)}`])
      // Taking the base pairs as bases gives half: marked wrong.
      expect(mark(b.question, String(ans / 2)).correct).toBe(false)
      expect(ans).not.toBe(given)
      expect(pct).not.toBe(25)
    }
    expect(contexts(built)).toBe(3)
    spread('dna-base-count-from-base-pairs', 'q25', ['N', 'p'])
  })
})

// =============================================================================================
// The triplet code
// =============================================================================================

describe('the triplet code', () => {
  it('protein q6: bases ÷ 3, a polypeptide of 100 to 800 for a whole gene', () => {
    const built = build('amino-acids-from-bases', 'q6')
    const limits: Record<string, [number, number]> = { section: [8, 99], gene: [100, 800], mRNA: [50, 600] }
    for (const b of built) {
      const n = num(/(\d+) bases/, b.question.prompt)
      expect(n % 3).toBe(0)
      expect(answer(b)).toBe(n / 3)
      const [lo, hi] = limits[b.values.context as string]!
      expect(answer(b)).toBeGreaterThanOrEqual(lo)
      expect(answer(b)).toBeLessThanOrEqual(hi)
      expect(b.question.solution).toBe(`Three bases, a triplet, code for one amino acid: $${n} \\div 3 = ${n / 3}$ amino acids.`)
      expect(method(b)).toEqual([`divides ${n} by 3`])
      if (b.values.context !== 'section') expect(b.question.prompt).toMatch(/[Ee]very triplet/)
    }
    expect(contexts(built)).toBe(3)
    spread('amino-acids-from-bases', 'q6', ['bases'])
  })

  it('protein q27: halve the total, take the non-coding base pairs, divide by 3', () => {
    const built = build('amino-acids-from-a-gene-with-non-coding-dna', 'q27')
    for (const b of built) {
      const p = b.question.prompt
      const T = num(/(\d+) bases (?:in total|altogether)/, p)
      const n = num(/(\d+) base pairs (?:are|of) non-coding/, p)
      expect(n).toBeGreaterThanOrEqual(40)
      expect(n).toBeLessThanOrEqual(400)
      const pairs = T / 2
      const coding = pairs - n
      const ans = coding / 3
      expect(Number.isInteger(ans)).toBe(true)
      expect(answer(b)).toBe(ans)
      expect(ans).toBeGreaterThanOrEqual(100)
      expect(ans).toBeLessThanOrEqual(800)
      expect(p).toContain('RNA polymerase binds')
      expect(b.question.solution).toContain(`$${T} \\div 2 = ${pairs}$ base pairs long.`)
      expect(b.question.solution).toContain(`$${pairs} - ${n} = ${coding}$ bases of coding DNA`)
      expect(b.question.solution).toContain(`$${coding} \\div 3 = ${ans}$ amino acids.`)
      expect(b.question.solution).toContain(`Check backwards: $${ans} \\times 3 = ${coding}$; $${coding} + ${n} = ${pairs}$; $${pairs} \\times 2 = ${T}$.`)
      expect(method(b)).toEqual([`halves the total to get ${pairs} base pairs, the length of one strand`, `subtracts the ${n} non-coding base pairs and divides the ${coding} by 3`])
      // Forgetting to halve is more than double, and marked wrong; so is forgetting the non-coding part.
      expect((T - n) / 3).toBeGreaterThan(2 * ans)
      expect(mark(b.question, String(Math.round(pairs / 3))).correct).toBe(false)
      expect(units(b)).toBe('amino acids')
    }
    expect(contexts(built)).toBe(2)
    spread('amino-acids-from-a-gene-with-non-coding-dna', 'q27', ['nonCoding'])
  })
})

// =============================================================================================
// ABO blood groups
// =============================================================================================

/** The test's own Punnett square, from first principles. */
function aboBoxes(p1: string, p2: string): string[] {
  const order = 'ABO'
  return [...p1].flatMap((x) => [...p2].map((y) => [x, y].sort((u, v) => order.indexOf(u) - order.indexOf(v)).join('')))
}
const groupOf = (g: string) => (g === 'OO' ? 'O' : g === 'AB' ? 'AB' : g.includes('A') ? 'A' : 'B')

describe('ABO blood groups', () => {
  for (const slot of ['q5', 'q20']) {
    it(`disorders ${slot}: the boxes of the square with the group or genotype asked, out of 4`, () => {
      const built = build('abo-blood-group-chance', slot)
      for (const b of built) {
        const p = b.question.prompt
        // The parents' genotypes are the two-letter words before the question.
        const [p1, p2] = [...p.split('What is')[0]!.matchAll(/\b([ABO]{2})\b/g)].map((m) => m[1]!)
        const kind = word(/has (blood group|genotype) /, p)
        const target = word(/has (?:blood group|genotype) ([ABO]{1,2})\?$/, p)
        const boxes = aboBoxes(p1!, p2!)
        const k = boxes.filter((x) => (kind === 'genotype' ? x === target : groupOf(x) === target)).length
        expect(answer(b)).toBe((k / 4) * 100)
        expect(k).toBeGreaterThan(0)
        expect(b.question.solution).toContain(`| | ${p2![0]} | ${p2![1]} |\n| --- | --- | --- |\n| ${p1![0]} | ${boxes[0]} | ${boxes[1]} |\n| ${p1![1]} | ${boxes[2]} | ${boxes[3]} |`)
        expect(b.question.solution).toContain(`${k} box${k === 1 ? '' : 'es'} in 4: $${k} \\div 4 \\times 100 = ${answer(b)}\\%$.`)
        expect(method(b)).toEqual([`offspring ${boxes.join(', ')}`])
        // Two identical homozygous parents would make every child the same: never drawn.
        expect(p1 === p2 && p1![0] === p1![1]).toBe(false)
        if (slot === 'q20') expect(p).toMatch(/^In the ABO blood group system, (the alleles )?A and B are codominant and O is recessive to both\./)
      }
      expect(contexts(built)).toBe(2)
      spread('abo-blood-group-chance', slot, ['p1'], 3)
    })
  }

  it('disorders q5: literal working for AO × BO, group AB', () => {
    const b = build('abo-blood-group-chance', 'q5', 3000, 'find').find((y) => y.values.p1 === 'AO' && y.values.p2 === 'BO' && y.values.target === 'AB')!
    expect(b.question.solution).toBe(
      'The AO parent gives **A** or **O**; the BO parent gives **B** or **O**.\n\n| | B | O |\n| --- | --- | --- |\n| A | AB | AO |\n| O | BO | OO |\n\nAs blood groups: AB → **AB**, AO → **A**, BO → **B**, OO → **O**.\n\nGroup AB is 1 box in 4: $1 \\div 4 \\times 100 = 25\\%$.',
    )
  })
})

// =============================================================================================
// X-linked disorders
// =============================================================================================

type St = 'clear' | 'carrier' | 'affected'
/** The test's own count: the mother's eggs (recessive or not) by the father's X or Y. */
function xCount(m: St, f: St, group: string, outcome: string): number {
  const eggs = m === 'clear' ? [0, 0] : m === 'carrier' ? [0, 1] : [1, 1]
  const fx = f === 'affected' ? 1 : 0
  const daughters = eggs.map((e) => e + fx)
  const sons = eggs
  const has = { d: daughters.filter((x) => x === 2).length, s: sons.filter((x) => x === 1).length }
  const carriers = daughters.filter((x) => x === 1).length
  const table: Record<string, [number, number]> = {
    'sons:affected': [has.s, 2],
    'sons:free': [2 - has.s, 2],
    'daughters:affected': [has.d, 2],
    'daughters:carriers': [carriers, 2],
    'all:affected': [has.s + has.d, 4],
    'all:carriers': [carriers, 4],
    'all:free': [4 - has.s - has.d, 4],
    'all:affected sons': [has.s, 4],
    'all:carrier daughters': [carriers, 4],
  }
  const [k, n] = table[`${group}:${outcome}`]!
  return (k / n) * 100
}
/** Who is asked about, and what about them, from the question's words. */
function xAsk(d: Linked, q: string) {
  const m = /percentage of (their (?:future )?sons|their (?:future )?daughters|all their (?:future )?children) (?:are )?expected (not )?to (.+?)[?.]$/.exec(q)
  if (!m) throw new Error(`no ask in: ${q}`)
  const group = m[1]!.includes('sons') ? 'sons' : m[1]!.includes('daughters') ? 'daughters' : 'all'
  const what = m[3]!
  const outcome =
    what === 'be carriers'
      ? 'carriers'
      : what === 'be daughters who are carriers'
        ? 'carrier daughters'
        : what.startsWith('be sons who')
          ? 'affected sons'
          : m[2] || what === d.free
            ? 'free'
            : 'affected'
  return { group, outcome }
}
const disorderOf = (p: string) => LINKED.find((d) => p.startsWith(d.intro) || p.startsWith(d.introAlleles))!

describe('X-linked crosses', () => {
  for (const slot of ['q7', 'q14', 'q19']) {
    it(`disorders ${slot}: the cross read over the denominator asked, with real disorders and real parents`, () => {
      const built = build('sex-linked-cross-percentage', slot)
      for (const b of built) {
        const p = b.question.prompt
        const d = disorderOf(p)
        expect(d, p).toBeDefined()
        const mText = word(/A woman who (.+?) (?:\(|has children)/, p)
        const fText = word(/a man who (.+?)(?: \(|\. )/, p)
        const m: St = mText.startsWith('does not carry') ? 'clear' : mText.startsWith('is a carrier') ? 'carrier' : 'affected'
        expect(m === 'affected' ? mText : d.is).toBe(d.is)
        const f: St = fText === d.is ? 'affected' : 'clear'
        if (f === 'clear') expect(fText).toBe(d.isNot)
        // No man with Duchenne muscular dystrophy is a father, and only colour blindness or the unnamed condition affects the mother.
        if (d === DUCHENNE) expect([m, f]).toEqual(['carrier', 'clear'])
        if (m === 'affected') expect([COLOUR_BLINDNESS, SEX_LINKED]).toContain(d)
        expect(m === 'clear' && f === 'clear').toBe(false)
        const { group, outcome } = xAsk(d, p)
        expect(answer(b)).toBe(xCount(m, f, group, outcome))
        // Genotypes given in brackets match the description.
        if (p.includes('(X')) {
          const mg = m === 'clear' ? d.dom + d.dom : m === 'carrier' ? d.dom + d.rec : d.rec + d.rec
          expect(p).toContain(`(${mg}) has children with a man who ${fText} (${f === 'affected' ? d.rec : d.dom}Y)`)
        }
        const den = group === 'all' ? 4 : 2
        expect(b.question.solution).toContain(` of the ${den} ${group === 'all' ? '' : `${group.slice(0, -1)} `}boxes, so $`)
        expect(b.question.solution).toContain(`\\div ${den} \\times 100 = ${answer(b)}\\%$.`)
        expect(method(b)[1]).toMatch(group === 'all' ? /^uses all four children as the denominator: \d of 4$/ : new RegExp(`^considers ${group} only: \\d of the 2 ${group.slice(0, -1)} boxes$`))
      }
      expect(contexts(built)).toBe(LINKED.length)
      const many = spread('sex-linked-cross-percentage', slot, [], 3)
      // Sons, daughters and all children about a third each, so "out of 4" pays only a third of the
      // time; Duchenne muscular dystrophy gives 25% and 75% only over all children, so it asks those more.
      for (const d of LINKED) {
        const mine = many.filter((b) => b.values.context === d.name)
        expect(new Set(mine.map((b) => b.values.group))).toEqual(new Set(['sons', 'daughters', 'all']))
        if (d !== DUCHENNE) expect(worstShare(mine, (b) => b.values.group).worst, d.name).toBeLessThanOrEqual(0.4)
      }
    })
  }

  it('disorders q7: literal working for a carrier and a man without haemophilia, sons', () => {
    const b = build('sex-linked-cross-percentage', 'q7', 3000, 'find').find((y) => y.values.context === 'haemophilia' && y.values.mother === 'carrier' && y.values.father === 'clear' && y.values.ask === 'sons-affected')!
    expect(b.question.solution).toBe(
      'A woman who is a carrier of haemophilia is XᴴXʰ; a man who does not have haemophilia is XᴴY. The cross is XᴴXʰ × XᴴY. Her eggs carry Xᴴ or Xʰ; his sperm carry Xᴴ or Y.\n\n' +
        '| | Xᴴ | Y |\n| --- | --- | --- |\n| Xᴴ | XᴴXᴴ | XᴴY |\n| Xʰ | XᴴXʰ | XʰY |\n\n' +
        'The daughters are the boxes with two X chromosomes: XᴴXᴴ and XᴴXʰ. The sons are XᴴY and XʰY: a son receives his X from his mother and the Y from his father.\n\n' +
        'Sons who have haemophilia: 1 of the 2 son boxes, so $1 \\div 2 \\times 100 = 50\\%$.',
    )
    expect(method(b)).toEqual(['draws the cross: XᴴXʰ × XᴴY gives daughters XᴴXᴴ and XᴴXʰ and sons XᴴY and XʰY', 'considers sons only: 1 of the 2 son boxes'])
  })

  it('disorders q19: literal square for a man with the condition and a woman without the allele', () => {
    const b = build('sex-linked-cross-percentage', 'q19', 3000, 'find').find((y) => y.values.context === 'condition' && y.values.mother === 'clear' && y.values.father === 'affected' && y.values.ask === 'daughters-carriers')!
    expect(b.question.solution).toContain('| | Xⁿ | Y |\n| --- | --- | --- |\n| Xᴺ | XᴺXⁿ | XᴺY |\n| Xᴺ | XᴺXⁿ | XᴺY |')
    expect(b.question.solution).toContain('Carrier daughters: 2 of the 2 daughter boxes, so $2 \\div 2 \\times 100 = 100\\%$.')
  })

  it('disorders q27: the woman is a carrier or not from her family, then the cross; each about half the time', () => {
    const built = build('sex-linked-carrier-from-the-family', 'q27')
    for (const b of built) {
      const p = b.question.prompt
      const d = disorderOf(p)
      expect([HAEMOPHILIA, COLOUR_BLINDNESS, SEX_LINKED]).toContain(d)
      // The woman never has the condition herself.
      expect(p).toMatch(new RegExp(`A woman (who )?${d.isNot}`))
      const carrier = !p.includes('genetic test')
      if (carrier) expect(p).toMatch(new RegExp(`but her father ${d.did}\\.|but her mother ${d.is}\\.|already have a (son|daughter) who ${d.is}\\.`))
      else expect(p).toContain(`Her father ${d.hadNot}, and a genetic test has shown that her mother does not carry the allele for ${d.of}.`)
      // A daughter who has it needs an affected father.
      if (/already have a daughter/.test(p)) expect(p).toContain(`her partner, who ${d.is},`)
      const fText = word(/(?:a man who|her partner, who) (.+?)[.,]/, p)
      const f: St = fText === d.is ? 'affected' : 'clear'
      if (!carrier) expect(f).toBe('affected')
      const { group, outcome } = xAsk(d, p)
      const m: St = carrier ? 'carrier' : 'clear'
      expect(answer(b)).toBe(xCount(m, f, group, outcome))
      // The other status gives another answer, so the deduction counts.
      expect(xCount(carrier ? 'clear' : 'carrier', f, group, outcome)).not.toBe(answer(b))
      expect(b.question.solution).toMatch(/^\*\*The woman's genotype\.\*\* /)
      expect(b.question.solution).toContain(carrier ? `she is a carrier, ${d.dom}${d.rec}.` : `The woman is ${d.dom}${d.dom}: she is not a carrier.`)
      expect(method(b)[0]).toMatch(new RegExp(`^deduces that the woman is ${carrier ? 'a carrier' : 'not a carrier'}, `))
    }
    expect(contexts(built)).toBe(3)
    const many = spread('sex-linked-carrier-from-the-family', 'q27', ['ask'], 3)
    expect(new Set(many.map((b) => b.values.clue))).toEqual(new Set(['father', 'mother', 'son', 'daughter', 'tested']))
    const carriers = share(many, (b) => b.values.carrier === 'true')
    expect(carriers).toBeGreaterThan(0.35)
    expect(carriers).toBeLessThan(0.65)
  })

  it('disorders q27: literal deduction from her father, crossed with a man who has haemophilia', () => {
    const b = build('sex-linked-carrier-from-the-family', 'q27', 3000, 'find').find((y) => y.values.context === 'haemophilia' && y.values.clue === 'father' && y.values.father === 'affected' && y.values.ask === 'daughters-affected')!
    expect(b.question.prompt).toMatch(/A woman does not have haemophilia, but her father did\. She has children with a man who has haemophilia\. Calculate the percentage of their daughters expected to have haemophilia\.$/)
    expect(b.question.solution).toContain(
      "**The woman's genotype.** Her father had haemophilia, so he was XʰY. A daughter receives her father's only X, so she received Xʰ. She does not have haemophilia, so her other X carries the dominant allele: she is a carrier, XᴴXʰ.",
    )
    expect(b.question.solution).toContain('Daughters who have haemophilia: 1 of the 2 daughter boxes, so $1 \\div 2 \\times 100 = 50\\%$.')
    expect(answer(b)).toBe(50)
  })
})

// =============================================================================================
// Monohybrid crosses
// =============================================================================================

/** The test's own square for two genotypes in any letters. */
function monoBoxes(g1: string, g2: string): string[] {
  return [...g1].flatMap((x) => [...g2].map((y) => [x, y].sort((u, v) => (u === u.toUpperCase() ? -1 : 1) - (v === v.toUpperCase() ? -1 : 1)).join('')))
}

describe('monohybrid crosses', () => {
  it('every trait is a real dominant and recessive pair, and the people are cystic fibrosis (recessive) and polydactyly (dominant)', () => {
    const rules = TRAITS.map((t) => t.rule)
    expect(rules).toContain('In pea plants, the allele for tall stems (T) is dominant to the allele for short stems (t).')
    expect(rules).toContain('In guinea pigs, the allele for black fur (B) is dominant to the allele for white fur (b).')
    expect(rules).toContain('In fruit flies, the allele for normal wings (N) is dominant to the allele for vestigial wings (n).')
    expect(rules).toContain('Cystic fibrosis is caused by a recessive allele (f); the dominant allele (F) does not cause it.')
    expect(rules).toContain('Polydactyly (extra fingers or toes) is caused by a dominant allele (D); the recessive allele (d) gives the usual number of fingers and toes.')
    expect(PLANT_TRAITS.every((t) => /plants$/.test(t.plural))).toBe(true)
  })

  for (const slot of ['q5', 'q19']) {
    it(`inheritance ${slot}: boxes of the square, dominant and recessive phenotypes about equally`, () => {
      const built = build('monohybrid-cross-percentage', slot)
      for (const b of built) {
        const p = b.question.prompt
        const gts = [...p.split('What percentage')[0]!.matchAll(/\(([A-Za-z]{2})\)/g)].map((m) => m[1]!)
        const [g1, g2] = gts.length === 1 ? [gts[0]!, gts[0]!] : [gts[0]!, gts[1]!]
        if (gts.length === 1) expect(p).toMatch(/Two (heterozygous|parents)/)
        const L = g1.toUpperCase()[0]!
        const boxes = monoBoxes(g1, g2)
        const q = word(/expected (.+)\?$/, p)
        const isHet = (x: string) => x[0] !== x[1]
        const isRec = (x: string) => x === L.toLowerCase().repeat(2)
        const tr = TRAITS.find((t) => p.startsWith(t.rule))!
        expect(tr, p).toBeDefined()
        let k: number
        if (/heterozygous|carriers/.test(q)) k = boxes.filter(isHet).length
        else if (/homozygous dominant/.test(q)) k = boxes.filter((x) => x === L + L).length
        else {
          // The dominant phenotype: the trait's dominant adjective, or "have polydactyly", or "not have cystic fibrosis".
          const dominant = tr.human ? (tr.name === 'polydactyly' ? q === 'to have polydactyly' : q === 'not to have cystic fibrosis') : q.includes(tr.domAdj)
          k = boxes.filter((x) => (dominant ? !isRec(x) : isRec(x))).length
        }
        expect(answer(b), p).toBe((k / 4) * 100)
        expect(b.question.solution).toContain(`The square holds **${boxes.join(', ')}**.`)
        expect(b.question.solution).toContain(`${k} of the 4 boxes, so $${k} \\div 4 \\times 100 = ${answer(b)}\\%$.`)
        expect(method(b)).toEqual([`gametes from ${g1} and ${g2}; offspring ${boxes.join(', ')}`])
        expect(p).toMatch(tr.human ? /their children are expected/ : /of the offspring are expected/)
      }
      expect(contexts(built)).toBe(TRAITS.length)
      const many = spread('monohybrid-cross-percentage', slot, [], 3)
      // Only Aa × Aa gives 25% and 75%, so with the answers even it is about half; the rest spread over the others.
      for (const tr of TRAITS) {
        const mine = many.filter((b) => b.values.context === tr.name)
        expect(share(mine, (b) => b.values.pair === 'Aa × Aa')).toBeLessThan(0.62)
        expect(new Set(mine.map((b) => b.values.pair)).size).toBe(4)
      }
      const phen = many.filter((b) => b.values.outcome === 'dominant' || b.values.outcome === 'recessive')
      const dom = share(phen, (b) => b.values.outcome === 'dominant')
      expect(dom).toBeGreaterThan(0.35)
      expect(dom).toBeLessThan(0.65)
    })
  }

  it('inheritance q19: literal working for Bb × bb guinea pigs, white fur', () => {
    const b = build('monohybrid-cross-percentage', 'q19', 3000, 'find').find((y) => y.values.context === 'guinea pig fur' && y.values.cross === 'Aa × aa' && y.values.outcome === 'recessive')!
    expect(b.question.prompt).toBe(
      'In guinea pigs, the allele for black fur (B) is dominant to the allele for white fur (b). A heterozygous guinea pig with black fur (Bb) is crossed with a guinea pig with white fur (bb). What percentage of the offspring are expected to have white fur?',
    )
    expect(b.question.solution).toBe(
      "The Bb parent's gametes carry **B** or **b**; the bb parent's carry only **b**. The square holds **Bb, Bb, bb, bb**. Only bb, with no B, shows the recessive characteristic: 2 of the 4 boxes, so $2 \\div 4 \\times 100 = 50\\%$.",
    )
  })

  it('inheritance q26: N × k ÷ 4 plants, for plants only, the cross and the phenotype each about half', () => {
    const built = build('expected-number-from-a-cross', 'q26')
    for (const b of built) {
      const p = b.question.prompt
      const tr = PLANT_TRAITS.find((t) => p.startsWith(t.rule))!
      expect(tr, p).toBeDefined()
      const N = num(/and (\d+) of the seeds produced grow into plants/, p)
      expect(N).toBeGreaterThanOrEqual(40)
      expect(N).toBeLessThanOrEqual(1200)
      const both = p.includes('Two heterozygous')
      const dominant = new RegExp(`expected to (be|have) ${tr.domAdj}\\b`).test(p)
      if (!dominant) expect(p).toMatch(new RegExp(`expected to (be|have) ${tr.recAdj}\\b`))
      const k = both ? (dominant ? 3 : 1) : 2
      expect(answer(b)).toBe((N * k) / 4)
      expect(sigFigures(answer(b))).toBeLessThanOrEqual(3)
      expect(tolerance(b)).toBe(0)
      expect(units(b)).toBe('plants')
      expect(b.question.solution).toContain(`= $${N} \\times ${k} \\div 4 = ${answer(b)}$.`)
      expect(b.question.solution).toContain(`Check: the other plants are $${N} - ${answer(b)} = ${N - answer(b)}$, and $${answer(b)} + ${N - answer(b)} = ${N}$.`)
      expect(method(b)[0]).toMatch(new RegExp(`^uses the cross to find that ${k} in 4 \\(${k * 25}%\\) (are|have) `))
      // The other phenotype's count is marked wrong.
      expect(mark(b.question, String(N - answer(b))).correct).toBe(N - answer(b) === answer(b))
    }
    expect(contexts(built)).toBe(PLANT_TRAITS.length)
    const many = spread('expected-number-from-a-cross', 'q26', ['N'])
    expect(share(many, (b) => b.values.dominant === 'true')).toBeGreaterThan(0.4)
    expect(share(many, (b) => b.values.dominant === 'true')).toBeLessThan(0.6)
    expect(share(many, (b) => b.values.cross === 'Aa × Aa')).toBeGreaterThan(0.4)
    expect(share(many, (b) => b.values.cross === 'Aa × Aa')).toBeLessThan(0.6)
  })

  it('inheritance q26: literal working for Tt × Tt, tall', () => {
    const b = build('expected-number-from-a-cross', 'q26', 3000, 'find').find((y) => y.values.context === 'pea height' && y.values.cross === 'Aa × Aa' && y.values.dominant === 'true')!
    const N = Number(b.values.N)
    expect(b.question.prompt).toBe(
      `In pea plants, the allele for tall stems (T) is dominant to the allele for short stems (t). Two heterozygous tall plants (Tt) are crossed, and ${N} of the seeds produced grow into plants. Calculate the number of these plants expected to be tall.`,
    )
    expect(b.question.solution).toContain('The Punnett square for Tt × Tt gives **TT, Tt, Tt, tt**. Tall plants: TT and Tt both carry the dominant allele T, so 3 in 4, or 75%.')
    expect(answer(b)).toBe((N * 3) / 4)
  })
})

// =============================================================================================
// A family table
// =============================================================================================

describe('a family table', () => {
  it('inheritance q20: the pattern from a daughter unlike both parents, then 1 : 2 : 1; recessive and dominant about half each', () => {
    const built = build('family-table-next-child', 'q20')
    for (const b of built) {
      const p = b.question.prompt
      const rows = p.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Person') && !l.startsWith('| ---'))
      const status = (name: string) => rows.find((r) => r.startsWith(`| ${name} |`))!.endsWith('| yes |')
      const [mum, dad] = [status('Mother'), status('Father')]
      expect(mum).toBe(dad)
      const children = rows.filter((r) => r.includes('| Mother and Father |'))
      expect(children.length).toBeGreaterThanOrEqual(2)
      expect(children.length).toBeLessThanOrEqual(4)
      // A daughter, not a son, differs from her parents: that rules out an X-linked gene.
      expect(children.some((r) => /daughter/i.test(r) && r.endsWith(mum ? '| no |' : '| yes |')), p).toBe(true)
      const dominant = mum
      const q = word(/chance that this child (.+)\?$/, p)
      const ans = q.startsWith('is ') ? 50 : (q === 'shows the condition') === dominant ? 75 : 25
      expect(answer(b)).toBe(ans)
      if (q.startsWith('is a carrier')) expect(dominant).toBe(false)
      expect(b.question.solution).toContain(dominant ? 'must be **dominant** (A): both parents are **Aa**.' : 'must be **recessive** (a) and each parent must carry one copy without showing it: both are **Aa**.')
      expect(b.question.solution).toContain(`so the chance is ${ans / 25} in 4: $${ans / 25} \\div 4 \\times 100 = ${ans}\\%$.`)
      expect(method(b)).toEqual([`deduces the condition is ${dominant ? 'dominant' : 'recessive'} and both parents are heterozygous`, 'Aa × Aa gives 1 AA : 2 Aa : 1 aa'])
    }
    const many = spread('family-table-next-child', 'q20', ['ask'], 3)
    const dom = share(many, (b) => b.values.context === 'dominant')
    expect(dom).toBeGreaterThan(0.4)
    expect(dom).toBeLessThan(0.6)
    // "Recessive, so 25%" is wrong for a dominant family asked who shows it.
    expect(many.some((b) => b.values.context === 'dominant' && b.values.ask === 'shows' && answer(b) === 75)).toBe(true)
  })
})

// =============================================================================================
// A genotype and a sex together
// =============================================================================================

describe('a family table, literally', () => {
  it('inheritance q20: a recessive family asked for a carrier, as the written one is', () => {
    const b = build('family-table-next-child', 'q20', 3000, 'find').find((y) => y.values.context === 'recessive' && y.values.ask === 'heterozygous' && y.values.children === 2)!
    expect(b.question.prompt).toMatch(/^A condition is controlled by a single gene\. The table describes one family\.\n\n\| Person \| Parents \| Shows the condition\? \|\n\| --- \| --- \| --- \|\n\| Mother \| not known \| no \|\n\| Father \| not known \| no \|\n/)
    expect(b.question.prompt).toMatch(/\n\nThe mother and father have another child\. What is the percentage chance that this child is a carrier: heterozygous, without showing the condition\?$/)
    expect(b.question.solution).toMatch(/^The (older |younger )?daughter shows the condition but \*\*neither parent does\*\*, so the allele must be \*\*recessive\*\* \(a\)/)
    expect(b.question.solution).toContain('The cross Aa × Aa gives **AA, Aa, Aa, aa**. The children who are carriers come from the two **Aa** boxes, so the chance is 2 in 4: $2 \\div 4 \\times 100 = 50\\%$.')
  })
})

describe('a genotype and a sex together', () => {
  it('inheritance q27: the genotype chance from the family times ½; girl or boy, with or without, each about half', () => {
    const built = build('genotype-and-sex-chance', 'q27')
    for (const b of built) {
      const p = b.question.prompt
      const d = AUTOSOMAL.find((x) => p.startsWith(x.rule))!
      expect(d, p).toBeDefined()
      expect(p).toContain('A child is equally likely to be a boy or a girl, and sex does not affect this gene.')
      const both = p.includes('Two parents')
      const want = word(/will be a (?:girl|boy) who (.+)\.$/, p)
      const has = want === d.has
      const carrier = want.startsWith('is a carrier')
      if (carrier) expect(d.dominant).toBe(false)
      // Both heterozygous: 1 AA : 2 Aa : 1 aa. One heterozygous and one homozygous recessive: 2 Aa : 2 aa.
      const [AA, Aa, aa] = both ? [1, 2, 1] : [0, 2, 2]
      const shows = d.dominant ? AA + Aa : aa
      const k = carrier ? Aa : has ? shows : 4 - shows
      expect(answer(b)).toBe(c((k / 4) * (1 / 2) * 100))
      expect(b.question.solution).toContain(`$\\dfrac{${k}}{4} \\times \\dfrac{1}{2} = `)
      expect(b.question.solution).toContain(`\\times 100 = ${answer(b)}\\%$.`)
      expect(method(b)[1]).toMatch(/^multiplies by the chance of a (girl|boy), 1 in 2$/)
      // The family really does fix the parents: the known child shows each parent carries the recessive allele.
      if (d.dominant) expect(p).toMatch(/who does not( have)?/)
      else expect(p).toMatch(/who (also )?has (it|cystic fibrosis|the condition)/)
    }
    expect(contexts(built)).toBe(AUTOSOMAL.length)
    const many = spread('genotype-and-sex-chance', 'q27', [], 3)
    const girls = share(many, (b) => b.values.girl === 'true')
    expect(girls).toBeGreaterThan(0.4)
    expect(girls).toBeLessThan(0.6)
    const withIt = share(many.filter((b) => b.values.want !== 'carrier'), (b) => b.values.want === 'has')
    expect(withIt).toBeGreaterThan(0.35)
    expect(withIt).toBeLessThan(0.65)
  })

  it('inheritance q27: literal working for Ff × Ff, a girl with cystic fibrosis', () => {
    const b = build('genotype-and-sex-chance', 'q27', 4000, 'find').find((y) => y.values.context === 'cystic fibrosis' && y.values.both === 'true' && y.values.extra === 'false' && y.values.girl === 'true' && y.values.want === 'has')!
    expect(b.question.prompt).toMatch(/^Cystic fibrosis is caused by a recessive allele \(f\) of a gene that is not on a sex chromosome; the dominant allele \(F\) does not cause it\. Two parents who do not have cystic fibrosis have a (son|daughter) who has it\./)
    expect(b.question.solution).toContain('**The gene.** Ff × Ff: each Ff parent\'s gametes carry F or f, giving **FF, Ff, Ff, ff**. Here the ff box has cystic fibrosis, so the chance that a child has cystic fibrosis is 1 in 4.')
    expect(b.question.solution).toContain('**Both together.** The two are independent, so multiply: $\\dfrac{1}{4} \\times \\dfrac{1}{2} = \\dfrac{1}{8}$, and $1 \\div 8 \\times 100 = 12.5\\%$.')
    expect(answer(b)).toBe(12.5)
  })
})

// =============================================================================================
// Meiosis, fertilisation and asexual reproduction
// =============================================================================================

describe('chromosome numbers', () => {
  const real = Object.fromEntries([...ANIMALS, ...PLANTS])
  it('meiosis q4: half the body-cell number, each species its own', () => {
    const built = build('meiosis-gamete-chromosome-number', 'q4')
    for (const b of built) {
      const p = b.question.prompt
      const two = num(/(\d+) chromosomes/, p)
      const sp = b.values.species as string
      expect(real[sp]).toBe(two)
      expect(p).toContain(sp)
      expect(answer(b)).toBe(two / 2)
      expect(b.question.solution).toContain(`**half the chromosomes** of a body cell: $${two} \\div 2 = ${two / 2}$.`)
      expect(method(b)).toEqual(['halves the body-cell number'])
      expect(mark(b.question, String(two)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(2)
    spread('meiosis-gamete-chromosome-number', 'q4', ['species'])
  })

  it('meiosis q9: two haploid sets restore the body-cell number', () => {
    const built = build('fertilisation-zygote-chromosome-number', 'q9')
    for (const b of built) {
      const p = b.question.prompt
      const n = num(/(\d+) chromosomes/, p)
      const sp = b.values.species as string
      expect(real[sp]).toBe(2 * n)
      expect(p).toContain(sp)
      expect(answer(b)).toBe(2 * n)
      expect(b.question.solution).toContain(`$${n} + ${n} = ${2 * n}$`)
      expect(mark(b.question, String(n)).correct).toBe(false)
      if (b.values.context === 'plant') expect(p).toMatch(/pollen grain|flower/)
      else expect(p).toMatch(/sperm|egg|gametes/)
    }
    expect(contexts(built)).toBe(2)
    spread('fertilisation-zygote-chromosome-number', 'q9', ['species'])
  })
})

describe('asexual reproduction', () => {
  it('meiosis q25: the hours in minutes, the divisions, then start × 2ⁿ', () => {
    const built = build('asexual-reproduction-doubling', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const d = num(/every (\d+) minutes/, p)
      const m = /after (\d+) hours(?: (\d+) minutes)?,/.exec(p)!
      const t = Number(m[1]) * 60 + Number(m[2] ?? 0)
      const s = /Starting from a single bacterium/.test(p) ? 1 : num(/Starting from (\d+) bacteria/, p)
      expect(d).toBeGreaterThanOrEqual(15)
      expect(d).toBeLessThanOrEqual(40)
      expect(t % d).toBe(0)
      const n = t / d
      expect(answer(b)).toBe(s * 2 ** n)
      expect(sigFigures(answer(b))).toBeLessThanOrEqual(3)
      expect(b.question.solution).toContain(`is ${t} minutes, so the number of divisions is $${t} \\div ${d} = ${n}$.`)
      expect(b.question.solution).toContain(`= ${answer(b)}$ bacteria.`)
      expect(b.question.solution).toContain(`Step by step: ${Array.from({ length: n + 1 }, (_, i) => s * 2 ** i).join(' → ')}, which is ${n} doublings.`)
      expect(method(b)[0]).toBe(`converts ${m[0].slice(6, -1)} to ${t} minutes and finds ${n} divisions`)
      expect(units(b)).toBe('bacteria')
      // Forgetting the start, or one division too few, is marked wrong.
      if (s > 1) expect(mark(b.question, String(2 ** n)).correct).toBe(false)
      expect(mark(b.question, String(s * 2 ** (n - 1))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(3)
    spread('asexual-reproduction-doubling', 'q25', ['d', 'n', 's'])
  })
})
