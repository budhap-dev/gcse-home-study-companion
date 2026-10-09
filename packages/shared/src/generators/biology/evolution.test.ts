import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { EVOLUTION, evolutionGenerators } from './evolution.ts'

/**
 * Structural tests for the variation, evolution, adaptation and breeding generators. Each reads the
 * prompt's own figures back, works the answer again from them alone with plain arithmetic, and
 * checks every printed step: the percentage before the count, the doublings from the time before
 * the power of two, both means before their difference, both surveys' percentages before the
 * change in points, the gap in years before the division, the time the sediment took before it is
 * added or taken away, both cubes' ratios before they are compared, the mean of the sample before
 * the gain per generation, and the harvest per hectare before the whole farm. Across builds they
 * check every context turns up, every figure is real for what is named, and that no answer or
 * input fills a context. Some builds are checked as literal text, never rebuilt with the
 * generator's own helpers.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/biology')
const bankOf = (topic: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bankOf(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `${prefix}-${i}`))
}
function one(generatorId: string, slotId: string, seed: string): Generated {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  return generate(g, bankOf(g.topicId).find((q) => q.id === slotId)!, seed)
}

/** A figure as plain arithmetic prints it, free of binary residue. */
const c = (x: number) => Number(x.toPrecision(12))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const last = (b: Generated) => b.question.markScheme.at(-1)!.description
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const sigFigures = (x: number) => String(c(x)).replace('.', '').replace(/^0+/, '').replace(/0+$/, '').length
const decimals = (x: number) => (String(c(x)).split('.')[1] ?? '').length
/** A number from the prompt, read with its spaced thousands: "14 000" is 14000. */
const num = (re: RegExp, s: string) => {
  const m = re.exec(s)
  if (!m) throw new Error(`${re} not in: ${s}`)
  return Number(m[1]!.trim().replace(/ /g, ''))
}
const within = (x: number, lo: number, hi: number) => x >= lo - 1e-9 && x <= hi + 1e-9
const isPowerOfTen = (x: number) => Math.abs(Math.log10(Math.abs(x)) - Math.round(Math.log10(Math.abs(x)))) < 1e-9
/** In maths, from five digits a thin space between thousands: 14\\,000. */
const texed = (x: number) => (Math.abs(x) >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : String(x))
/** In prose, from five digits a space between thousands: 14 000. */
const spaced = (x: number) => (Math.abs(x) >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(x))
/** The written answer box takes this: the answer to three significant figures. */
const threeSf = (x: number) => Number(x.toPrecision(3))
/** An answer worked from the prompt: itself when it ends within 4 places with 3 figures at most, else its 3-figure rounding. */
const three = (x: number) => (decimals(x) <= 4 && sigFigures(x) <= 3 ? c(x) : threeSf(x))
/** Half a unit in the last decimal place, capped at 1.9%; none for a whole number. */
const halfPlace = (x: number, dp = decimals(x)) => (dp === 0 ? 0 : Math.min(0.5 * 10 ** -dp, Math.abs(x) * 0.019))
/** Half a unit in the third significant figure, capped at 1.9%. */
const sfHalf = (x: number) => Math.min(0.5 * 10 ** (Math.floor(Math.log10(Math.abs(x))) - 2), Math.abs(x) * 0.019)
const WORDS: Record<string, number> = { three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 }
const marked = (b: Generated, x: number) => mark(b.question, String(c(x))).correct

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
function spread(id: string, slot: string, keys: string[], fewest = 10) {
  const many = build(id, slot, 2000, 'spread')
  const a = worstShare(many, answer)
  expect(a.worst, `${id} ${slot} answer`).toBeLessThanOrEqual(0.4)
  expect(a.fewest, `${id} ${slot} answers per context`).toBeGreaterThanOrEqual(fewest)
  for (const k of keys) expect(worstShare(many, (b) => b.values[k]).worst, `${id} ${slot} ${k}`).toBeLessThanOrEqual(0.4)
}

describe('every evolution build', () => {
  it('has a generator for each numeric written slot it can vary, and leaves the four fossil facts written', () => {
    const claimed = evolutionGenerators.flatMap((g) => g.replaces.map((id) => `${g.topicId}/${id}`)).sort()
    expect(claimed).toEqual(
      [
        ...['q6', 'q9', 'q19', 'q25', 'q26'].map((q) => `variation-and-natural-selection/${q}`),
        ...['q25', 'q26'].map((q) => `evidence-for-evolution-and-classification/${q}`),
        ...['q13', 'q24', 'q25'].map((q) => `classification-adaptation-and-evolution/${q}`),
        ...['q6', 'q26', 'q27'].map((q) => `selective-breeding-and-genetic-engineering/${q}`),
      ].sort(),
    )
    for (const id of ['q1', 'q4', 'q9', 'q19']) expect(claimed).not.toContain(`evidence-for-evolution-and-classification/${id}`)
  })

  it('prints no article before a figure, keeps the written units, and is marked right with its own answer and its three-figure rounding', () => {
    for (const g of evolutionGenerators) {
      for (const id of g.replaces) {
        const slot = bankOf(g.topicId).find((q) => q.id === id)!
        for (const b of build(g.id, id, 150)) {
          expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          expect(b.question.type === 'numeric' && b.question.units, `${g.id} ${id}`).toBe(slot.type === 'numeric' && slot.units)
          expect(b.question.solution, b.seed).toContain(String(answer(b)))
          expect(mark(b.question, String(answer(b))).correct, b.seed).toBe(true)
          // A count of bacteria after doubling is exact, and nobody rounds it: only it is right.
          if (g.id !== 'resistant-population-doubling') expect(mark(b.question, String(threeSf(answer(b)))).correct, `${b.seed} ${answer(b)}`).toBe(true)
          expect(tolerance(b), b.seed).toBeLessThanOrEqual(Math.abs(answer(b)) * 0.02)
          expect(b.check.agrees, b.seed).toBe(true)
        }
      }
    }
  })

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const g of evolutionGenerators) {
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
// Variation and natural selection
// =============================================================================================

describe('variation and natural selection', () => {
  it('q6: p% of the population is the count carrying the trait', () => {
    const built = build('resistant-share-count', 'q6')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = EVOLUTION.CARRIERS.find((x) => x.name === b.values.context)!
      const n = num(/(?:population of|records) ([\d ]+?) /, p)
      const pct = num(/([\d.]+)% /, p)
      expect(within(pct, ctx.share[0], ctx.share[1]), b.seed).toBe(true)
      expect(within(n, ctx.sizes[0], ctx.sizes[1]), b.seed).toBe(true)
      expect(answer(b)).toBe(c((pct * n) / 100))
      expect(Number.isInteger(answer(b)), b.seed).toBe(true)
      expect(answer(b)).toBeGreaterThanOrEqual(3)
      // Never 1% or 10% (the population with the point moved), nor 2, 5, 20 or 50% (doubled or halved).
      for (const x of [n, n * 2, n / 2, pct, pct * 2, pct / 2]) expect(isPowerOfTen(answer(b) / x), `${b.seed} ${pct}% of ${n}`).toBe(false)
      expect(b.question.solution).toContain(`$${pct}\\% \\times ${texed(n)} = \\dfrac{${pct}}{100} \\times ${texed(n)} = ${answer(b)}$ ${ctx.counted}.`)
      expect(method(b)).toEqual([`finds ${pct}% of ${spaced(n)}`])
      expect(last(b)).toBe(String(answer(b)))
      expect(tolerance(b)).toBe(0)
      // Forgetting to divide by 100 is marked wrong.
      expect(marked(b, pct * n)).toBe(false)
    }
    expect(contexts(built)).toBe(EVOLUTION.CARRIERS.length)
    const lit = one('resistant-share-count', 'q6', 'review-a')
    expect(lit.question.prompt).toBe('In a population of 3900 *Staphylococcus aureus* bacteria, 3% are resistant to the antibiotic methicillin. How many of the bacteria are resistant?')
    expect(lit.question.solution).toContain('$3\\% \\times 3900 = \\dfrac{3}{100} \\times 3900 = 117$ resistant bacteria.')
    spread('resistant-share-count', 'q6', ['n', 'p'])
  })

  it('q9: the doublings come from the time, then the survivors times 2 to that power', () => {
    const built = build('resistant-population-doubling', 'q9')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = EVOLUTION.BUGS.find((x) => x.name === b.values.context)!
      const n = num(/(?:leaves |, )(\d+) (?:resistant )?\*/, p)
      const t = num(/every (\d+) minutes/, p)
      const m = /after (\d+) hours?(?: (\d+) minutes)?/.exec(p)!
      const minutes = Number(m[1]) * 60 + Number(m[2] ?? 0)
      const k = minutes / t
      expect(Number.isInteger(k), b.seed).toBe(true)
      expect(EVOLUTION.SURVIVORS).toContain(n)
      expect(ctx.times).toContain(t)
      expect(EVOLUTION.DOUBLINGS).toContain(k)
      expect(p).toContain(ctx.species)
      expect(p).toContain(ctx.antibiotic)
      // Never a power of two or ten: the answer would be a bare power of two, or one with the point moved.
      expect(Number.isInteger(Math.log2(n)) || isPowerOfTen(n)).toBe(false)
      expect(answer(b)).toBe(n * 2 ** k)
      expect(b.question.solution).toContain(`is ${minutes} minutes, so the population doubles $${minutes} \\div ${t} = ${k}$ times.`)
      expect(b.question.solution).toContain(`$${n} \\times 2^{${k}} = ${n} \\times ${texed(2 ** k)}`)
      expect(method(b)).toEqual([`finds the number of doublings, ${minutes} ÷ ${t} = ${k}`, `uses 2 to the power ${k} and multiplies by ${n}`])
      expect(tolerance(b)).toBe(0)
      // Doubling once too few or too many times, or multiplying by 2k, is marked wrong.
      for (const wrong of [n * 2 ** (k - 1), n * 2 ** (k + 1), n * 2 * k]) expect(marked(b, wrong)).toBe(false)
    }
    expect(contexts(built)).toBe(EVOLUTION.BUGS.length)
    spread('resistant-population-doubling', 'q9', ['n', 't', 'k'])
  })

  it('q9: a literal build', () => {
    const b = one('resistant-population-doubling', 'q9', 'review-c')
    expect(b.question.prompt).toBe(
      'A course of the antibiotic trimethoprim leaves 18 resistant *Escherichia coli* bacteria alive. In ideal conditions each bacterium divides into two every 25 minutes. Assuming every bacterium survives and divides, how many bacteria will there be after 3 hours 45 minutes?',
    )
    expect(b.question.solution).toBe(
      '3 hours 45 minutes is 225 minutes, so the population doubles $225 \\div 25 = 9$ times. $18 \\times 2^{9} = 18 \\times 512 = 9216$ bacteria. Every one of them carries the resistance, so trimethoprim will no longer clear the infection.',
    )
    expect(answer(b)).toBe(9216)
  })

  it('q19: the later percentage ÷ the earlier, read from a rising table', () => {
    const built = build('resistance-table-ratio', 'q19')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = EVOLUTION.TESTED.find((x) => x.name === b.values.context)!
      const rows = [...p.matchAll(/^\| (\d{4}) \| (\d+) \|$/gm)].map((m) => [Number(m[1]), Number(m[2])] as const)
      expect(rows).toHaveLength(4)
      const [late, early] = [num(/resistant samples in (\d{4})/, p), num(/than in (\d{4})\?$/, p)]
      const a = rows.find(([y]) => y === early)![1]
      const z = rows.find(([y]) => y === late)![1]
      const pcs = rows.map(([, v]) => v)
      const years = rows.map(([y]) => y)
      // Evenly spaced years, the percentages rising every row, and none of them the answer.
      expect(new Set(years.slice(1).map((y, i) => y - years[i]!)).size).toBe(1)
      for (let i = 1; i < 4; i++) expect(pcs[i]!, b.seed).toBeGreaterThan(pcs[i - 1]!)
      expect(pcs[0]).toBeGreaterThanOrEqual(2)
      expect(pcs[3]).toBeLessThanOrEqual(80)
      expect(pcs).not.toContain(answer(b))
      expect(late).toBeGreaterThan(early)
      expect(answer(b)).toBe(c(z / a))
      expect(within(answer(b), 1.5, 8)).toBe(true)
      expect(decimals(answer(b))).toBeLessThanOrEqual(2)
      expect(sigFigures(answer(b))).toBeLessThanOrEqual(3)
      expect(tolerance(b)).toBe(c(halfPlace(answer(b))))
      expect(p).toContain(`samples of ${ctx.species}, taken in a hospital, that were resistant to ${ctx.antibiotic}.`)
      expect(b.question.solution).toContain(`$${z} \\div ${a} = ${answer(b)}$, so the percentage was ${answer(b)} times greater.`)
      expect(method(b)).toEqual([`${z} ÷ ${a}`])
      // The difference, the ratio upside down, and the first and last rows when they were not asked are marked wrong.
      expect(marked(b, z - a)).toBe(false)
      expect(marked(b, a / z)).toBe(false)
      if (pcs[3] !== z || pcs[0] !== a) expect(marked(b, pcs[3]! / pcs[0]!)).toBe(false)
    }
    expect(contexts(built)).toBe(EVOLUTION.TESTED.length)
    // Each pair of rows is asked about in a third of builds or so, so "last over first" pays a third of the time.
    const asks = new Map<unknown, number>()
    for (const b of build('resistance-table-ratio', 'q19', 900, 'asks')) asks.set(b.values.ask, (asks.get(b.values.ask) ?? 0) + 1)
    expect(asks.size).toBe(3)
    for (const n of asks.values()) expect(n / 900).toBeGreaterThan(0.25)
    spread('resistance-table-ratio', 'q19', ['a', 'b', 'early'])
  })

  it('q25: both means from the table, then their difference', () => {
    const built = build('sun-and-shade-leaf-means', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = EVOLUTION.TREES.find((x) => x.name === b.values.context)!
      const sh = /\| Shaded \| ([\d, ]+) \|/.exec(p)![1]!.split(', ').map(Number)
      const su = /\| Sunny \| ([\d, ]+) \|/.exec(p)![1]!.split(', ').map(Number)
      const n = WORDS[/length of (\w+) leaves/.exec(p)![1]!]!
      expect(sh).toHaveLength(n)
      expect(su).toHaveLength(n)
      expect(p).toContain(`one ${ctx.tree} have the same alleles`)
      const [ts, tu] = [sh.reduce((s, x) => s + x, 0), su.reduce((s, x) => s + x, 0)]
      const [ms, mu] = [ts / n, tu / n]
      expect(Number.isInteger(ms) && Number.isInteger(mu), b.seed).toBe(true)
      expect(within(mu, ...ctx.sunny)).toBe(true)
      expect(within(ms - mu, ...ctx.longer)).toBe(true)
      // Leaves of one side within 12% of their mean, none repeated, and not in order.
      for (const [xs, m] of [[sh, ms], [su, mu]] as const) {
        expect(new Set(xs).size).toBe(n)
        for (const x of xs) expect(Math.abs(x - m) / m, b.seed).toBeLessThanOrEqual(0.121)
        expect(xs.every((x, i) => i === 0 || x > xs[i - 1]!)).toBe(false)
      }
      expect(answer(b)).toBe(ms - mu)
      expect(b.question.solution).toContain(`Shaded side: $${sh.join(' + ')} = ${ts}$, and $${ts} \\div ${n} = ${ms}$ mm.`)
      expect(b.question.solution).toContain(`Sunny side: $${su.join(' + ')} = ${tu}$, and $${tu} \\div ${n} = ${mu}$ mm.`)
      expect(b.question.solution).toContain(`Difference: $${ms} - ${mu} = ${answer(b)}$ mm.`)
      expect(method(b)).toEqual([`mean for the shaded side: ${ts} ÷ ${n} = ${ms} mm`, `mean for the sunny side: ${tu} ÷ ${n} = ${mu} mm`])
      expect(last(b)).toBe(`${answer(b)} mm`)
      expect(tolerance(b)).toBe(0)
      // The difference of the totals is marked wrong.
      expect(marked(b, ts - tu)).toBe(false)
    }
    expect(contexts(built)).toBe(EVOLUTION.TREES.length)
    spread('sun-and-shade-leaf-means', 'q25', ['sunny', 'shaded', 'n'])
  })

  it('q26: each survey to a percentage, then the change in percentage points', () => {
    const built = build('natural-selection-percentage-points', 'q26')
    const read: Record<string, (p: string) => number[]> = {
      'moths darken': (p) => [num(/caught (\d+) peppered/, p), num(/of which (\d+) were dark and/, p), num(/same wood caught (\d+)/, p), num(/same wood caught \d+, of which (\d+)/, p)],
      'moths lighten': (p) => [num(/caught (\d+) peppered/, p), num(/peppered moths, of which (\d+)/, p), num(/same wood caught (\d+)/, p), num(/same wood caught \d+, of which (\d+)/, p)],
      rats: (p) => [num(/warfarin, (\d+) rats/, p), num(/there were tested and (\d+)/, p), num(/poisoning, (\d+) rats/, p), num(/same area were tested and (\d+)/, p)],
      bacteria: (p) => [num(/year, \d+ of (\d+)/, p), num(/year, (\d+) of/, p), num(/antibiotics, \d+ of (\d+)/, p), num(/antibiotics, (\d+) of/, p)],
    }
    for (const b of built) {
      const p = b.question.prompt
      const ctx = EVOLUTION.SELECTIONS.find((x) => x.name === b.values.context)!
      const [n1, d1, n2, d2] = read[ctx.name]!(p)
      const [p1, p2] = [c((d1! / n1!) * 100), c((d2! / n2!) * 100)]
      expect(Number.isInteger(p1) && Number.isInteger(p2), b.seed).toBe(true)
      expect(within(p1, ...ctx.before)).toBe(true)
      expect(within(p2, ...ctx.after)).toBe(true)
      expect(within(n1!, ctx.sizes[0], ctx.sizes[1]) && within(n2!, ctx.sizes[0], ctx.sizes[1])).toBe(true)
      expect(n1).not.toBe(n2)
      for (const n of [n1, n2]) expect([100, 200, 500]).not.toContain(n)
      expect(p).toMatch(new RegExp(`by how many percentage points the percentage of ${ctx.form} ${ctx.rises ? 'increased' : 'decreased'}\\.$`))
      expect(answer(b)).toBe(Math.abs(p2 - p1))
      expect(answer(b)).toBeGreaterThanOrEqual(10)
      expect([p1, p2, d1, d2]).not.toContain(answer(b))
      expect(b.question.solution).toContain(`Before: $\\dfrac{${d1}}{${n1}} \\times 100 = ${p1}\\%$ ${ctx.short}.`)
      expect(b.question.solution).toContain(`After: $\\dfrac{${d2}}{${n2}} \\times 100 = ${p2}\\%$ ${ctx.short}.`)
      expect(b.question.solution).toContain(ctx.rises ? `Increase: $${p2} - ${p1} = ${answer(b)}$ percentage points.` : `Decrease: $${p1} - ${p2} = ${answer(b)}$ percentage points.`)
      expect(method(b)).toEqual([`percentage ${ctx.short} before: ${d1} ÷ ${n1} × 100 = ${p1}%`, `percentage ${ctx.short} after: ${d2} ÷ ${n2} × 100 = ${p2}%`])
      expect(last(b)).toBe(`${answer(b)} percentage points`)
      expect(tolerance(b)).toBe(0)
      // Subtracting the counts, or giving the percentage change, is marked wrong.
      expect(marked(b, Math.abs(d2! - d1!))).toBe(false)
      expect(marked(b, Math.abs((p2 - p1) / p1) * 100)).toBe(false)
    }
    expect(contexts(built)).toBe(EVOLUTION.SELECTIONS.length)
    spread('natural-selection-percentage-points', 'q26', ['p1', 'p2', 'n1', 'n2'])
  })

  it('q26: a literal build', () => {
    const b = one('natural-selection-percentage-points', 'q26', 'review-c')
    expect(b.question.prompt).toBe(
      'In the 1800s, soot from factories blackened the bark of the trees in industrial parts of Britain. Birds find and eat more of the peppered moths that stand out against the bark, and colour in peppered moths is inherited. ' +
        'Early in this period, a survey of one wood caught 350 peppered moths, of which 14 were dark and the rest pale. Several decades later, a survey of the same wood caught 450, of which 423 were dark. Calculate by how many percentage points the percentage of dark moths increased.',
    )
    expect(b.question.solution).toContain('Before: $\\dfrac{14}{350} \\times 100 = 4\\%$ dark.\n\nAfter: $\\dfrac{423}{450} \\times 100 = 94\\%$ dark.\n\nIncrease: $94 - 4 = 90$ percentage points.')
    expect(answer(b)).toBe(90)
  })
})

// =============================================================================================
// Evidence for evolution: the fossil timescale
// =============================================================================================

describe('the fossil timescale', () => {
  it('q25: the gap in years ÷ the generation time', () => {
    const built = build('fossil-gap-generations', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = EVOLUTION.LINES.find((x) => x.name === b.values.context)!
      const ages = [...p.matchAll(/([\d.]+) million years ago/g)].map((m) => Number(m[1]))
      expect(ages).toHaveLength(2)
      const g = num(/generation time (?:of [\w ]+ was |of )(\d+) years/, p)
      // The real dates of the fossils named, older first.
      const named = ctx.fossils.filter((f) => p.includes(f.short))
      expect(named.map((f) => f.age)).toEqual(ages)
      expect(ages[0]!).toBeGreaterThan(ages[1]!)
      expect(ctx.times).toContain(g)
      expect([5, 10, 20]).not.toContain(g)
      const gap = c(ages[0]! - ages[1]!)
      const years = c(gap * 1e6)
      const exact = years / g
      expect(answer(b)).toBe(three(exact))
      // An answer never the gap with the point moved, doubled or halved.
      for (const x of [gap, gap * 2, gap / 2]) expect(isPowerOfTen(answer(b) / x), b.seed).toBe(false)
      const rounded = answer(b) !== c(exact)
      expect(tolerance(b)).toBe(rounded ? c(sfHalf(answer(b))) : 0)
      expect(b.question.solution).toContain(`Time between them: $${ages[0]} - ${ages[1]} = ${gap}$ million years $= ${texed(years)}$ years.`)
      if (rounded) {
        expect(b.question.solution).toContain(`$${texed(years)} \\div ${g} = `)
        expect(b.question.solution).toContain(`\\ldots$, which is **${answer(b)} generations** to 3 significant figures.`)
        // The unrounded count is marked right.
        expect(marked(b, Math.round(exact))).toBe(true)
      } else expect(b.question.solution).toContain(answer(b) < 10000 ? `$${texed(years)} \\div ${g} = ${answer(b)}$` : `$${texed(years)} \\div ${g}$, which is **${answer(b)} generations**`)
      expect(method(b)).toEqual([`finds the time between them, ${gap} million years (${spaced(years)} years), and divides by ${g}`])
      expect(last(b)).toBe(`${spaced(answer(b))} generations`)
      // Forgetting the million, or multiplying, is marked wrong.
      expect(marked(b, gap / g)).toBe(false)
      expect(marked(b, years * g)).toBe(false)
    }
    expect(contexts(built)).toBe(EVOLUTION.LINES.length)
    spread('fossil-gap-generations', 'q25', ['pair', 'g'])
  })

  it('q25: a literal build, and the written slot\'s own figures', () => {
    const b = one('fossil-gap-generations', 'q25', 'review-b')
    expect(b.question.prompt).toBe(
      '*Mesohippus*, a three-toed horse, lived about 35 million years ago and *Merychippus*, a grazing three-toed horse, lived about 15 million years ago. Assuming an average generation time of 6 years, calculate how many generations of horse ancestors would fit into the time between *Mesohippus* and *Merychippus*.',
    )
    expect(b.question.solution).toContain('$20\\,000\\,000 \\div 6 = 3\\,333\\,333.3\\ldots$, which is **3330000 generations** to 3 significant figures.')
    expect(answer(b)).toBe(3330000)
    expect(tolerance(b)).toBe(5000)
    expect(1200000 / 20).toBe(60000)
  })

  it('q26: the time the sediment took, taken from the ash above it or added below it', () => {
    const built = build('tool-date-from-sediment', 'q26')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = EVOLUTION.FINDS.find((x) => x.name === b.values.context)!
      const ash = num(/dated to ([\d.]+) million/, p)
      const s = num(/rate of ([\d.]+) m every/, p)
      const h = num(/sediment ([\d.]+) m (?:above|below)/, p)
      const above = /m above the top of the ash/.test(p)
      expect(above).toBe(ctx.above)
      expect(p.startsWith('At a dig') && p.includes(ctx.above ? 'Above the ash, sediment' : 'Below the ash, sediment')).toBe(true)
      expect(within(s, 1, 20) && within(h, 0.5, 30)).toBe(true)
      const lots = c(h / s)
      const t = c(lots / 10)
      expect(decimals(lots)).toBeLessThanOrEqual(1)
      expect(lots).not.toBe(1)
      expect(answer(b)).toBe(c(above ? ash - t : ash + t))
      expect(within(answer(b), ...ctx.made), b.seed).toBe(true)
      expect(tolerance(b)).toBe(c(halfPlace(answer(b), Math.max(decimals(ash), decimals(t)))))
      expect(b.question.solution).toContain(`Time for ${h} m of sediment to build up: $${h} \\div ${s} = ${lots}$ lots of 100 000 years $= ${texed(c(lots * 100000))}$ years $= ${t}$ million years.`)
      expect(b.question.solution).toContain(
        above ? `so it is **younger** than the ash: $${ash} - ${t} = ${answer(b)}$ million years ago.` : `so it is **older** than the ash: $${ash} + ${t} = ${answer(b)}$ million years ago.`,
      )
      expect(method(b)).toEqual([
        `time for ${h} m to build up: ${h} ÷ ${s} × 100 000 = ${spaced(c(lots * 100000))} years (${t} million years)`,
        `${above ? 'subtracts from' : 'adds to'} the date of the ash, because the ${ctx.short} lies ${above ? 'above' : 'below'} it`,
      ])
      expect(last(b)).toBe(`${answer(b)} million years ago`)
      // The wrong direction, and the time left in lots of 100 000 years, are marked wrong.
      expect(marked(b, above ? ash + t : ash - t)).toBe(false)
      expect(marked(b, above ? ash - lots : ash + lots)).toBe(false)
    }
    expect(contexts(built)).toBe(EVOLUTION.FINDS.length)
    // Above and below in about equal shares, so "always subtract" pays half the time.
    const aboveShare = built.filter((b) => /m above the top/.test(b.question.prompt)).length / built.length
    expect(within(aboveShare, 0.4, 0.6)).toBe(true)
    spread('tool-date-from-sediment', 'q26', ['ash', 's', 'h', 't'])
  })

  it('q26: a literal build', () => {
    const b = one('tool-date-from-sediment', 'q26', 'review-c')
    expect(b.question.prompt).toBe(
      'At a dig, a layer of volcanic ash is dated to 1.28 million years ago. Above the ash, sediment built up at a steady rate of 2.5 m every 100 000 years, and the layers have not been disturbed. A stone hand axe lies in the sediment 14 m above the top of the ash. Estimate how long ago the hand axe was left there, in millions of years.',
    )
    expect(b.question.solution).toContain('Time for 14 m of sediment to build up: $14 \\div 2.5 = 5.6$ lots of 100 000 years $= 560\\,000$ years $= 0.56$ million years.')
    expect(b.question.solution).toContain('so it is **younger** than the ash: $1.28 - 0.56 = 0.72$ million years ago.')
    expect(answer(b)).toBe(0.72)
    expect(tolerance(b)).toBe(0.005)
  })
})

// =============================================================================================
// Classification, adaptation and evolution
// =============================================================================================

describe('classification, adaptation and evolution', () => {
  it('q13: the larger form ÷ the smaller, from one percentage', () => {
    const built = build('one-form-per-other', 'q13')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = EVOLUTION.MAJORITIES.find((x) => x.name === b.values.context)!
      const pct = num(/ (\d+)% of the/, p)
      expect(within(pct, ...ctx.range)).toBe(true)
      expect(ctx.asks).toContain(p.slice(p.lastIndexOf('. ') + 2))
      const big = ctx.majority ? pct : 100 - pct
      const small = 100 - big
      expect(big).toBeGreaterThan(small)
      const exact = big / small
      expect(answer(b)).toBe(three(exact))
      const rounded = answer(b) !== c(exact)
      expect(tolerance(b)).toBe(rounded ? c(sfHalf(answer(b))) : c(halfPlace(answer(b))))
      expect(b.question.solution).toContain(`If ${pct} in every 100 were ${ctx.given}, ${100 - pct} were ${ctx.other}.`)
      expect(b.question.solution).toContain(rounded ? `$${big} \\div ${small} = ` : `$${big} \\div ${small} = ${answer(b)}$ ${ctx.per}.`)
      if (rounded) expect(b.question.solution).toContain(`, which is ${answer(b)} to 3 significant figures, so there were about ${answer(b)} ${ctx.per}.`)
      expect(method(b)).toEqual([`${100 - pct}% ${ctx.other}`])
      // "One in every 7 is pale, so 7 dark for every pale one" is marked wrong, and so is the percentage itself.
      expect(marked(b, 100 / small)).toBe(false)
      expect(marked(b, big)).toBe(false)
    }
    expect(contexts(built)).toBe(EVOLUTION.MAJORITIES.length)
    spread('one-form-per-other', 'q13', ['p'])
  })

  it('q24: the count of the other form, as a percentage of all of them', () => {
    const built = build('other-form-percentage', 'q24')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = EVOLUTION.COUNTS.find((x) => x.name === b.values.context)!
      const n = num(/(\d+) (?:peppered moths|brown rats) were/, p)
      const d = num(/(\d+) of them were/, p)
      expect(within(n, ...ctx.sizes)).toBe(true)
      // Never a survey of 10, 20, 25, 50, 100, 200, 250 or 500, where the percentage is the count scaled.
      for (const k of [1, 2, 2.5, 5]) expect(isPowerOfTen(n / k)).toBe(false)
      const m = n - d
      const pct = c((m / n) * 100)
      expect(answer(b)).toBe(pct)
      expect(within(pct, ...ctx.share)).toBe(true)
      expect(decimals(pct)).toBeLessThanOrEqual(1)
      expect(sigFigures(pct)).toBeLessThanOrEqual(3)
      expect(tolerance(b)).toBe(c(halfPlace(pct)))
      expect(p).toMatch(new RegExp(`Calculate the percentage of the (?:moths|rats) that were ${ctx.asked}\\.$`))
      expect(b.question.solution).toContain(`number $${n} - ${d} = ${m}$. As a percentage of all the ${ctx.plural} recorded, $\\dfrac{${m}}{${n}} \\times 100 = ${pct}\\%$.`)
      expect(b.question.solution).toContain(`only ${c(100 - pct)}% were ${ctx.counted}.`)
      expect(method(b)).toEqual([`finds ${m} ${ctx.asked} ${ctx.plural} and divides by ${n}`])
      expect(last(b)).toBe(`${pct}%`)
      // The counted form's percentage is marked wrong.
      expect(marked(b, (d / n) * 100)).toBe(false)
    }
    expect(contexts(built)).toBe(EVOLUTION.COUNTS.length)
    spread('other-form-percentage', 'q24', ['n', 'd'])
  })

  it('q25: each cube\'s surface area and volume, each ratio, then the small ratio ÷ the large', () => {
    const built = build('cube-ratio-comparison', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = EVOLUTION.PAIRS.find((x) => x.name === b.values.context)!
      const a = num(/cube of side ([\d.]+) cm stands/, p)
      const z = num(/and a cube of side ([\d.]+) cm for/, p)
      expect(EVOLUTION.SIDES).toContain(a)
      expect(EVOLUTION.SIDES).toContain(z)
      expect(within(a, ...ctx.small) && within(z, ...ctx.large)).toBe(true)
      expect(z).toBeGreaterThan(a)
      expect(p).toContain(`models two ${ctx.group} as cubes`)
      const [sa, va, sz, vz] = [c(6 * a * a), c(a ** 3), c(6 * z * z), c(z ** 3)]
      const [ra, rz] = [c(sa / va), c(sz / vz)]
      expect(decimals(ra)).toBeLessThanOrEqual(3)
      expect(decimals(rz)).toBeLessThanOrEqual(3)
      expect(answer(b)).toBe(c(ra / rz))
      expect(answer(b)).toBe(c(z / a))
      // No ratio of 1, and an answer that is no side, ratio or power of ten.
      expect(ra === 1 || rz === 1).toBe(false)
      expect([a, z, ra, rz, c(z - a)]).not.toContain(answer(b))
      expect(isPowerOfTen(answer(b))).toBe(false)
      expect(decimals(answer(b))).toBeLessThanOrEqual(2)
      expect(tolerance(b)).toBe(c(halfPlace(answer(b))))
      expect(b.question.solution).toContain(`Small cube: $6 \\times ${a} \\times ${a} = ${texed(sa)}\\ \\text{cm}^2$ and $${a} \\times ${a} \\times ${a} = ${texed(va)}\\ \\text{cm}^3$, so the ratio is $\\dfrac{${texed(sa)}}{${texed(va)}} = ${ra}$.`)
      expect(b.question.solution).toContain(`Large cube: $6 \\times ${z} \\times ${z} = ${texed(sz)}\\ \\text{cm}^2$ and $${z} \\times ${z} \\times ${z} = ${texed(vz)}\\ \\text{cm}^3$, so the ratio is $\\dfrac{${texed(sz)}}{${texed(vz)}} = ${rz}$.`)
      expect(b.question.solution).toContain(`The small cube's ratio is $\\dfrac{${ra}}{${rz}} = ${answer(b)}$ times larger.`)
      expect(method(b)).toEqual([`surface areas ${spaced(sa)} and ${spaced(sz)} cm² and volumes ${spaced(va)} and ${spaced(vz)} cm³`, `ratios ${ra} and ${rz}`])
      // The ratio of areas or of volumes, or the small cube's own ratio, is marked wrong.
      for (const wrong of [(z / a) ** 2, (z / a) ** 3, ra, rz]) expect(marked(b, wrong)).toBe(false)
    }
    expect(contexts(built)).toBe(EVOLUTION.PAIRS.length)
    spread('cube-ratio-comparison', 'q25', ['a', 'b'])
  })
})

// =============================================================================================
// Selective breeding and genetic engineering
// =============================================================================================

describe('selective breeding and genetic engineering', () => {
  it('q6: the increase ÷ the original yield × 100', () => {
    const built = build('bred-yield-percentage-increase', 'q6')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = EVOLUTION.YIELDS.find((x) => x.name === b.values.context)!
      const m = /from ([\d.]+) to ([\d.]+) /.exec(p)!
      const [ta, tb] = [m[1]!, m[2]!]
      const [a, z] = [Number(ta), Number(tb)]
      // Tonnes print with their one decimal place, as 4.0 does; the rest are whole.
      if (ctx.dp) expect(ta.split('.')[1]).toHaveLength(1)
      else expect(Number.isInteger(a) && Number.isInteger(z)).toBe(true)
      expect(within(a, ctx.from[0], ctx.from[1])).toBe(true)
      const d = c(z - a)
      const pct = c((d / a) * 100)
      expect(answer(b)).toBe(pct)
      expect(within(pct, ...ctx.rise)).toBe(true)
      expect(decimals(pct)).toBeLessThanOrEqual(2)
      expect(sigFigures(pct)).toBeLessThanOrEqual(3)
      // Never the increase, nor either yield, with the point moved, doubled or halved.
      for (const g of [a, z, d]) for (const x of [g, g * 2, g / 2]) expect(isPowerOfTen(pct / x), `${b.seed} ${a} ${z}`).toBe(false)
      expect(tolerance(b)).toBe(c(halfPlace(pct)))
      const f = (x: number) => (ctx.dp ? x.toFixed(1) : String(x))
      expect(b.question.solution).toBe(`The increase is $${tb} - ${ta} = ${f(d)}$. Then $(${f(d)} \\div ${ta}) \\times 100 = ${pct}\\%$.`)
      expect(method(b)).toEqual([`finds the increase of ${f(d)}`, `divides by the original ${ta} and multiplies by 100`])
      expect(last(b)).toBe(`${pct}%`)
      // Dividing by the new yield, or giving the new as a percentage of the old, is marked wrong.
      expect(marked(b, (d / z) * 100)).toBe(false)
      expect(marked(b, (z / a) * 100)).toBe(false)
    }
    expect(contexts(built)).toBe(EVOLUTION.YIELDS.length)
    spread('bred-yield-percentage-increase', 'q6', ['a', 'b'])
  })

  it('q6: a literal build', () => {
    const b = one('bred-yield-percentage-increase', 'q6', 'review-b')
    expect(b.question.prompt).toBe('A new variety of wheat, bred from the plants with the highest yields, raises the yield on a farm from 8.4 to 10.5 tonnes per hectare. What is the percentage increase?')
    expect(b.question.solution).toBe('The increase is $10.5 - 8.4 = 2.1$. Then $(2.1 \\div 8.4) \\times 100 = 25\\%$.')
    expect(answer(b)).toBe(25)
    expect(tolerance(b)).toBe(0)
    // The written slot's own figures.
    expect(c(((5.2 - 4.0) / 4.0) * 100)).toBe(30)
  })

  it('q26: the mean of the sample, less the start, ÷ the generations', () => {
    const built = build('breeding-gain-per-generation', 'q26')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = EVOLUTION.HERDS.find((x) => x.name === b.values.context)!
      const start = num(/mean milk yield is ([\d ]+?) litres/, p)
      const g = WORDS[/After (\w+) generations/.exec(p)![1]!]!
      const n = WORDS[/a sample of (\w+) /.exec(p)![1]!]!
      const xs = /give yields of ([\d ,and]+?) litres per year/.exec(p)![1]!.split(/, | and /).map((x) => Number(x.replace(/ /g, '')))
      expect(xs).toHaveLength(n)
      expect(EVOLUTION.BRED).toContain(g)
      expect(EVOLUTION.SAMPLED).toContain(n)
      expect(g).not.toBe(n)
      expect(within(start, ctx.start[0], ctx.start[1])).toBe(true)
      expect(p).toContain(`per ${ctx.one} per year`)
      const total = xs.reduce((s, x) => s + x, 0)
      const mean = c(total / n)
      for (const x of xs) {
        expect(x % ctx.grid).toBe(0)
        expect(Math.abs(x - mean) / mean, b.seed).toBeLessThanOrEqual(0.121)
      }
      expect(new Set(xs).size).toBe(n)
      const rise = c(mean - start)
      expect(answer(b)).toBe(c(rise / g))
      expect(Number.isInteger(answer(b))).toBe(true)
      // A gain of 2 to 6% of the start a generation.
      expect(within(answer(b) / start, 0.02 - 1e-9, 0.06 + 1e-9), b.seed).toBe(true)
      expect(b.question.solution).toContain(`Mean of the sample: $${xs.map(texed).join(' + ')} = ${texed(total)}$, and $${texed(total)} \\div ${n} = ${texed(mean)}$ litres per year.`)
      expect(b.question.solution).toContain(`Total increase: $${texed(mean)} - ${texed(start)} = ${texed(rise)}$ litres per year.`)
      expect(b.question.solution).toContain(`Increase per generation: $${texed(rise)} \\div ${g} = ${answer(b)}$ litres per year.`)
      expect(method(b)[0]).toBe(`mean of the ${Object.keys(WORDS).find((w) => WORDS[w] === n)} ${ctx.ones}: ${spaced(total)} ÷ ${n} = ${spaced(mean)}`)
      expect(method(b)[1]).toContain(`${spaced(mean)} − ${spaced(start)} = ${spaced(rise)}, by the`)
      expect(last(b)).toBe(`${answer(b)} litres per year`)
      expect(tolerance(b)).toBe(0)
      // Dividing by the number of animals sampled, or giving the whole rise, is marked wrong.
      expect(marked(b, rise / n)).toBe(false)
      expect(marked(b, rise)).toBe(false)
    }
    expect(contexts(built)).toBe(EVOLUTION.HERDS.length)
    spread('breeding-gain-per-generation', 'q26', ['start', 'g', 'n'])
  })

  it('q27: the extra kept per hectare, times the area', () => {
    const built = build('bt-crop-extra-harvest', 'q27')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = EVOLUTION.CROPS.find((x) => x.name === b.values.context)!
      const area = num(/on ([\d.]+) hectares?\./, p)
      const y = num(/would yield ([\d.]+) tonnes/, p)
      const p1 = num(/loses (\d+)% of this yield/, p)
      const p2 = num(/loses only (\d+)%/, p)
      expect(within(area, ctx.area[0], ctx.area[1]) && within(y, ctx.potential[0], ctx.potential[1])).toBe(true)
      expect(within(p1, ...ctx.ordinary) && within(p2, ...ctx.modified)).toBe(true)
      expect(isPowerOfTen(area) || isPowerOfTen(p1 - p2)).toBe(false)
      expect(p).toContain(`A farmer grows ${ctx.first} on`)
      const per = c((y * (p1 - p2)) / 100)
      const total = c(area * per)
      expect(answer(b)).toBe(total)
      expect(decimals(total)).toBeLessThanOrEqual(2)
      expect(sigFigures(total)).toBeLessThanOrEqual(3)
      expect(tolerance(b)).toBe(c(halfPlace(total)))
      // Not the extra per hectare with the point moved, doubled or halved.
      for (const x of [per, per * 2, per / 2]) expect(isPowerOfTen(total / x), b.seed).toBe(false)
      const [k1, k2] = [c(y * (1 - p1 / 100)), c(y * (1 - p2 / 100))]
      const yt = ctx.dp ? y.toFixed(1) : String(y)
      expect(b.question.solution).toContain(`the ordinary crop keeps ${100 - p1}%, so $${yt} \\times ${c((100 - p1) / 100)} = ${k1}$ tonnes; the Bt crop keeps ${100 - p2}%, so $${yt} \\times ${c((100 - p2) / 100)} = ${k2}$ tonnes.`)
      expect(b.question.solution).toContain(`Difference per hectare: $${k2} - ${k1} = ${per}$ tonnes.`)
      expect(b.question.solution).toContain(`Whole farm: $${per} \\times ${area} = ${total}$ tonnes.`)
      expect(b.question.solution).toContain(`Check: the ordinary crop gives $${k1} \\times ${area} = ${c(k1 * area)}$ tonnes, the Bt crop $${k2} \\times ${area} = ${c(k2 * area)}$ tonnes`)
      expect(method(b)[0]).toBe(`finds the harvest per hectare of each (${k1} t and ${k2} t), or ${p1 - p2}% of ${yt} = ${per} t; any valid route`)
      expect(last(b)).toBe(`${spaced(total)} tonnes`)
      // The extra per hectare, either harvest, or the ordinary crop's loss alone, is marked wrong.
      for (const wrong of [per, k2 * area, k1 * area, (area * y * p1) / 100]) expect(marked(b, wrong)).toBe(false)
    }
    expect(contexts(built)).toBe(EVOLUTION.CROPS.length)
    spread('bt-crop-extra-harvest', 'q27', ['y', 'p1', 'p2', 'a'])
  })
})
