import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { BIOENERGETICS, bioenergeticsGenerators } from './bioenergetics.ts'

/**
 * Structural tests for the bioenergetics generators. Each reads the prompt's own figures back,
 * works the answer again from them with plain arithmetic, and checks every printed step of the
 * working and the mark scheme's method lines, the units the written slot carries, the tolerance
 * rule, that every context turns up and that no answer or input fills a context. They check the
 * biology stays real: enzyme times on each practical's own grid, lab energies per gram below the
 * packet's, lamps 5 to 100 cm away, and respirometer drops at the speed seeds and woodlice really
 * move them. Some lines are checked as literal text.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/biology')
const banks = new Map<string, Question[]>()
const bankOf = (topic: string) => {
  if (!banks.has(topic)) banks.set(topic, Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions))
  return banks.get(topic)!
}

function build(generatorId: string, slotId: string, count = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bankOf(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `${prefix}-${i}`))
}

/** A figure as plain arithmetic prints it, free of binary residue. */
const c = (x: number) => Number(x.toPrecision(12))
const txt = (x: number) => String(c(x))
const num = (re: RegExp, s: string) => {
  const m = re.exec(s)
  if (!m) throw new Error(`${re} not in: ${s}`)
  return Number(m[1]!.replace(/ /g, ''))
}
const nums = (re: RegExp, s: string) => [...s.matchAll(re)].map((m) => Number(m[1]!.replace(/ /g, '')))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const last = (b: Generated) => b.question.markScheme.at(-1)!.description
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const within = (x: number, lo: number, hi: number) => x >= lo - 1e-9 && x <= hi + 1e-9
const sigFigures = (x: number) => txt(x).replace('.', '').replace(/^0+/, '').replace(/0+$/, '').length
const places = (x: number) => (txt(x).split('.')[1] ?? '').length
/** In maths, from five digits a thin space between thousands: 12\\,600. */
const texed = (x: number) => (x >= 10000 ? txt(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : txt(x))
/** In prose, from five digits a space between thousands: 12 600. */
const prosed = (x: number) => (x >= 10000 ? txt(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : txt(x))
const isPowerOfTen = (x: number) => Math.abs(Math.log10(x) - Math.round(Math.log10(x))) < 1e-9
/** Half a unit in the dp-th place, never more than 1.9% of x. */
const half = (dp: number, x: number) => (dp <= 0 ? 0 : Number(Math.min(0.5 * 10 ** -dp, Math.abs(x) * 0.019).toPrecision(10)))
/** The tolerance an exact answer gets: half a unit in its last place, widened to its 3-figure rounding past three figures. */
const exactTol = (x: number) => {
  const own = half(places(x), x)
  if (sigFigures(x) <= 3) return own
  const sf3 = Number(Math.min(0.5 * 10 ** (Math.floor(Math.log10(Math.abs(x))) - 2), Math.abs(x) * 0.019).toPrecision(10))
  return Math.max(own, sf3)
}
/** Exact to dp places with at most three figures. */
const tidy = (x: number, dp = 2) => Math.abs(x * 10 ** dp - Math.round(x * 10 ** dp)) < 1e-6 && sigFigures(x) <= 3

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
/**
 * No answer or input over 40% of a context's builds, checked on two seed sets of 2000 against
 * 37%, so a draw that sits near the limit fails here rather than on someone else's seeds.
 */
function spread(id: string, slot: string, keys: string[], fewest = 10) {
  for (const seeds of ['spread', 'again']) {
    const many = build(id, slot, 2000, seeds)
    const a = worstShare(many, answer)
    expect(a.worst, `${id} answer (${seeds})`).toBeLessThanOrEqual(0.37)
    expect(a.fewest, `${id} answers per context`).toBeGreaterThanOrEqual(fewest)
    for (const k of keys) expect(worstShare(many, (b) => b.values[k]).worst, `${id} ${k} (${seeds})`).toBeLessThanOrEqual(0.37)
  }
}

/** Every numeric written slot in the four topics; food tests q4 (25 cm³ of water is 25 g) stays written. */
const SLOTS: Record<string, string[]> = {
  'enzymes-and-how-they-work': ['q15', 'q25', 'q26', 'q6'],
  'food-tests-and-calorimetry': ['q15', 'q25', 'q26', 'q6'],
  'photosynthesis-and-limiting-factors': ['q10', 'q15', 'q24', 'q25', 'q7', 'q9'],
  'aerobic-and-anaerobic-respiration': ['q16', 'q25', 'q26', 'q6'],
}

describe('every bioenergetics build', () => {
  it('has a generator for every numeric written slot in the four topics but food tests q4', () => {
    for (const [topic, ids] of Object.entries(SLOTS)) {
      const numeric = bankOf(topic).filter((q) => q.type === 'numeric').map((q) => q.id)
      expect(numeric.filter((id) => !(topic === 'food-tests-and-calorimetry' && id === 'q4')).sort(), topic).toEqual(ids)
      expect(bioenergeticsGenerators.filter((g) => g.topicId === topic).flatMap((g) => g.replaces).sort(), topic).toEqual(ids)
    }
    // q4 asks the mass of 25 cm³ of water: the given volume read again in grams.
    const q4 = bankOf('food-tests-and-calorimetry').find((q) => q.id === 'q4')!
    expect(q4.type === 'numeric' && q4.answer).toBe(25)
  })

  it('prints no article before a figure, keeps the units, reaches its answer and is marked right at three figures', () => {
    for (const g of bioenergeticsGenerators) {
      for (const id of g.replaces) {
        const slot = bankOf(g.topicId).find((q) => q.id === id)!
        for (const b of build(g.id, id, 150)) {
          const q = b.question
          expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          expect(q.type === 'numeric' && q.units, b.seed).toBe(slot.type === 'numeric' && slot.units)
          expect(q.solution, b.seed).toContain(String(answer(b)))
          expect(mark(q, String(answer(b))).correct, b.seed).toBe(true)
          // A calculated answer the prompt gives no precision for is marked right at three figures.
          if (!/decimal place|significant figure/.test(q.prompt)) expect(mark(q, String(Number(answer(b).toPrecision(3)))).correct, `${b.seed} three figures`).toBe(true)
          expect(tolerance(b)).toBeLessThanOrEqual(Math.abs(answer(b)) * 0.02)
          expect(b.check.agrees, b.seed).toBe(true)
        }
      }
    }
  })

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const g of bioenergeticsGenerators) {
      for (const id of g.replaces) {
        const slot = bankOf(g.topicId).find((q) => q.id === id)!
        expect(() => {
          for (let i = 0; i < 3000; i++) generate(g, slot, `throw-${i}`)
        }, `${g.id} ${id}`).not.toThrow()
      }
    }
  })
})

// =============================================================================================
// Enzymes
// =============================================================================================

const PRACTICAL = (b: Generated) => BIOENERGETICS.PRACTICALS.find((p) => b.question.prompt.includes(p.setup) || b.question.prompt.includes(`the ${p.short}`))!
/** Each practical's own times: whole tens of seconds for iodine every 10 s, a catalase disc in 5 to 60 s. */
function onPracticalGrid(name: string, t: number, repeat = false) {
  if (name === 'amylase') return t % 10 === 0 && within(t, 20, repeat ? 960 : 800)
  if (name === 'catalase') return Number.isInteger(c(t * (repeat ? 10 : 2))) && within(t, repeat ? 4 : 5, repeat ? 70 : 60)
  if (name === 'trypsin') return Number.isInteger(t) && within(t, 30, repeat ? 1040 : 900)
  return Number.isInteger(t) && within(t, repeat ? 50 : 60, repeat ? 1040 : 900)
}
/**
 * 1000 ÷ t as the slots mark it, worked here by plain arithmetic: exact when it ends within two
 * places with at most three figures, else to three figures; the printed text keeps a trailing zero.
 */
function rate1000(t: number) {
  const raw = 1000 / t
  const exact = Math.abs(raw * 100 - Math.round(raw * 100)) < 1e-6 && sigFigures(c(raw)) <= 3
  const answer = exact ? c(raw) : Number(raw.toPrecision(3))
  const text = exact ? txt(raw) : raw.toPrecision(3)
  const tol = exact ? exactTol(answer) : Number(Math.min(0.5 * 10 ** (Math.floor(Math.log10(answer)) - 2), answer * 0.019).toPrecision(10))
  return { raw, exact, answer, text, tol }
}
/** An answer that is a figure, the figure with the point moved, or the figure doubled or halved (60% beside 30 °C). */
const echoes = (x: number, f: number) => isPowerOfTen(Math.abs(x / f)) || Math.abs(x - 2 * f) < 1e-9 || Math.abs(2 * x - f) < 1e-9

describe('enzymes and how they work', () => {
  it('q6: 1000 ÷ any time on the practical\'s own grid, exact or to 3 significant figures', () => {
    const built = build('enzyme-rate', 'q6')
    for (const b of built) {
      const p = PRACTICAL(b)
      expect(b.values.context).toBe(p.name)
      const t = num(/after (\d+(?:\.\d+)?) s/, b.question.prompt)
      expect(onPracticalGrid(p.name, t)).toBe(true)
      const x = rate1000(t)
      expect(answer(b)).toBe(x.answer)
      expect(isPowerOfTen(x.answer) || x.answer === 1).toBe(false)
      expect(b.question.prompt).toContain(p.setup)
      expect(b.question.prompt).toMatch(/rate = 1000 ÷ time in seconds/)
      expect(b.question.solution).toMatch(
        x.exact
          ? new RegExp(`^\\$\\\\dfrac\\{1000\\}\\{${txt(t)}\\} = ${txt(x.answer)}\\$, in arbitrary units\\.`)
          : new RegExp(`^\\$\\\\dfrac\\{1000\\}\\{${txt(t)}\\} = ${String(x.raw).slice(0, 4).replace('.', '\\.')}\\d*\\\\ldots\\$, which is ${x.text.replace('.', '\\.')} to 3 significant figures, in arbitrary units\\.`),
      )
      expect(method(b)).toEqual(['divides 1000 by the time'])
      expect(last(b)).toBe(x.text)
      expect(tolerance(b)).toBe(x.tol)
      // The unrounded rate, and its 3-figure rounding, are marked right; the time itself is not.
      expect(mark(b.question, String(x.raw)).correct).toBe(true)
      expect(mark(b.question, x.raw.toPrecision(3)).correct).toBe(true)
      expect(mark(b.question, txt(t)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    // Both exact and rounded rates turn up.
    expect(built.some((b) => Number.isInteger(answer(b) * 100) && rate1000(b.values.t as number).exact)).toBe(true)
    expect(built.some((b) => !rate1000(b.values.t as number).exact)).toBe(true)
    spread('enzyme-rate', 'q6', ['t'])
  })

  it('q6: a literal build', () => {
    const b = build('enzyme-rate', 'q6', 2000, 'literal').find((x) => x.values.context === 'amylase' && x.values.t === 50 && x.question.prompt.includes('In one test'))!
    expect(b.question.prompt).toBe(
      'In the amylase and starch practical, a drop of the mixture is added to iodine every 10 seconds; the starch has all been digested when the iodine stops turning blue-black. In one test, the iodine stopped turning blue-black after 50 s. Calculate the rate using rate = 1000 ÷ time in seconds.',
    )
    expect(b.question.solution).toBe('$\\dfrac{1000}{50} = 20$, in arbitrary units. The shorter the time, the higher the rate.')
    expect(answer(b)).toBe(20)
    const rounded = build('enzyme-rate', 'q6', 2000, 'literal').find((x) => x.values.context === 'amylase' && x.values.t === 60)!
    expect(rounded.question.solution).toBe('$\\dfrac{1000}{60} = 16.666\\ldots$, which is 16.7 to 3 significant figures, in arbitrary units. The shorter the time, the higher the rate.')
    expect(answer(rounded)).toBe(16.7)
    expect(tolerance(rounded)).toBe(0.05)
  })

  it('q15: the longer time is the slower reaction, by a factor in the contrast\'s range', () => {
    const built = build('enzyme-times-faster', 'q15')
    let fastFirst = 0
    for (const b of built) {
      const p = b.question.prompt
      const ct = BIOENERGETICS.CONTRASTS.find((x) => x.name === b.values.context)!
      const m = /At (pH \d+|\d+ °C) .+? after (\d+(?:\.\d+)?) s; at (pH \d+|\d+ °C) it took (\d+(?:\.\d+)?) s\./.exec(p)!
      const [first, ta, second, tb] = [m[1]!, Number(m[2]), m[3]!, Number(m[4])]
      expect(new Set([first, second])).toEqual(new Set([ct.fast, ct.slow]))
      const tFast = first === ct.fast ? ta : tb
      const tSlow = first === ct.fast ? tb : ta
      if (first === ct.fast) fastFirst++
      expect(tSlow).toBeGreaterThan(tFast)
      expect(onPracticalGrid(ct.p.name, tFast) && onPracticalGrid(ct.p.name, tSlow)).toBe(true)
      const k = c(tSlow / tFast)
      expect(answer(b)).toBe(k)
      expect(tidy(k, 1)).toBe(true)
      expect(within(k, ...ct.k)).toBe(true)
      // Never a condition's own figure, nor one with the point moved, doubled or halved (3.5 beside pH 7).
      const printed = [...new Set([...p.matchAll(/(?:pH (\d+)|(\d+) °C)/g)].map((x) => Number(x[1] ?? x[2])))]
      expect(printed.sort()).toEqual([...ct.figures].sort())
      for (const f of printed) expect(echoes(k, f), `${b.seed}: ${k} beside ${f}`).toBe(false)
      expect(p).toContain(`A student says the reaction at ${ct.slow} was faster, because ${txt(tSlow)} is the bigger number. Calculate how many times faster the reaction at ${ct.fast} actually was.`)
      expect(b.question.solution).toContain(`\\dfrac{1000/${txt(tFast)}}{1000/${txt(tSlow)}} = \\dfrac{${txt(tSlow)}}{${txt(tFast)}} = ${txt(k)}$`)
      expect(b.question.solution).toContain(`**${txt(k)} times the time means a rate ${txt(k)} times smaller**`)
      // Each rate is exact or to three figures, as the written 16.7 is.
      for (const t of [tFast, tSlow]) {
        const x = rate1000(t)
        expect(b.question.solution).toContain(x.exact ? `\\dfrac{1000}{${txt(t)}} = ${x.text}` : `\\dfrac{1000}{${txt(t)}} \\approx ${x.text}`)
      }
      expect(method(b)).toEqual([`converts both times to rates, or compares the times directly: ${txt(tSlow)} ÷ ${txt(tFast)}`])
      expect(last(b)).toBe(`${txt(k)} times faster`)
      expect(tolerance(b)).toBe(half(places(k), k))
      // The lazy reading, the faster time over the slower, and the difference are marked wrong.
      expect(mark(b.question, String(c(tFast / tSlow))).correct).toBe(false)
      expect(k).not.toBe(c(tSlow - tFast))
    }
    expect(contexts(built)).toBe(6)
    expect(fastFirst / built.length).toBeGreaterThan(0.4)
    expect(fastFirst / built.length).toBeLessThan(0.6)
    spread('enzyme-times-faster', 'q15', ['t1', 't2'])
  })

  it('q25: three repeats running at most 15% of their mean, then 1000 ÷ the mean', () => {
    const built = build('enzyme-mean-rate', 'q25')
    let sameOrOnMean = 0
    for (const b of built) {
      const p = PRACTICAL(b)
      expect(b.values.context).toBe(p.name)
      const m = /after (\d+(?:\.\d+)?) s, (\d+(?:\.\d+)?) s and (\d+(?:\.\d+)?) s\./.exec(b.question.prompt)!
      const ts = [Number(m[1]), Number(m[2]), Number(m[3])]
      const sum = c(ts[0]! + ts[1]! + ts[2]!)
      const mean = c(sum / 3)
      const x = rate1000(mean)
      expect(answer(b)).toBe(x.answer)
      expect(onPracticalGrid(p.name, mean)).toBe(true)
      // The written 38, 40 and 42 s run 10% of their mean: no anomaly-sized spread, and not all the same.
      const range = Math.max(...ts) - Math.min(...ts)
      expect(range / mean, b.seed).toBeLessThanOrEqual(BIOENERGETICS.SPREAD + 1e-9)
      expect(range).toBeGreaterThan(0)
      if (new Set(ts).size < 3 || ts.includes(mean)) sameOrOnMean++
      for (const t of ts) expect(onPracticalGrid(p.name, t, true)).toBe(true)
      expect(b.question.solution).toContain(`Mean time first: $\\dfrac{${ts.map(txt).join(' + ')}}{3} = \\dfrac{${txt(sum)}}{3} = ${txt(mean)}$ s. Then the rate: $\\dfrac{1000}{${txt(mean)}} = `)
      expect(b.question.solution).toContain(x.exact ? `= ${x.text}$.` : `which is ${x.text} to 3 significant figures.`)
      expect(method(b)).toEqual([`mean time ${txt(mean)} s`, `divides 1000 by ${txt(mean)}`])
      expect(last(b)).toBe(x.text)
      expect(tolerance(b)).toBe(x.tol)
      expect(mark(b.question, x.raw.toPrecision(3)).correct).toBe(true)
      // Stopping at the mean time is marked wrong.
      expect(mark(b.question, txt(mean)).correct).toBe(false)
    }
    // Two equal repeats, or one on the mean, as the written 40 s is, turn up.
    expect(sameOrOnMean).toBeGreaterThan(0)
    // Median spread across builds: about the written question's, never anomaly-sized.
    const spreads = built.map((b) => [b.values.t1, b.values.t2, b.values.t3].map(Number)).map((ts) => (Math.max(...ts) - Math.min(...ts)) / ((ts[0]! + ts[1]! + ts[2]!) / 3)).sort((a, b) => a - b)
    expect(spreads[Math.floor(spreads.length / 2)]!).toBeLessThanOrEqual(0.12)
    expect(contexts(built)).toBe(4)
    spread('enzyme-mean-rate', 'q25', ['t1', 'mean'])
  })

  it('q26: the time ratio first, rates to 3 figures, and the increase worked from them lands within the tolerance', () => {
    const built = build('enzyme-rate-increase', 'q26')
    for (const b of built) {
      const rise = BIOENERGETICS.RISES.find((x) => x.name === b.values.context)!
      const p = b.question.prompt
      const [t1, t2] = nums(/after (\d+(?:\.\d+)?) s/g, p)
      expect(t1!).toBeGreaterThan(t2!)
      expect(onPracticalGrid(rise.p.name, t1!) && onPracticalGrid(rise.p.name, t2!)).toBe(true)
      // The set-up is always printed but for amylase, whose iodine test the written slot names.
      if (rise.p.name !== 'amylase') expect(p.startsWith(rise.p.setup)).toBe(true)
      const pct = c((t1! / t2! - 1) * 100)
      expect(Number.isInteger(pct)).toBe(true)
      expect(answer(b)).toBe(pct)
      expect(within(pct, ...rise.pct)).toBe(true)
      expect(pct).not.toBe(100)
      for (const f of rise.figures) expect(echoes(pct, f), `${b.seed}: ${pct}% beside ${f}`).toBe(false)
      const r1 = rate1000(t1!)
      const r2 = rate1000(t2!)
      const a = Number(r1.text)
      const bb = Number(r2.text)
      const worked = ((bb - a) / a) * 100
      const tol = Number(Math.min(0.5, pct * 0.019).toPrecision(10))
      expect(tolerance(b)).toBe(tol)
      // A student who keys the printed 3-figure rates is marked right, at full precision and at three figures.
      expect(mark(b.question, String(worked)).correct, `${b.seed}: ${worked}`).toBe(true)
      expect(mark(b.question, worked.toPrecision(3)).correct, `${b.seed}: ${worked}`).toBe(true)
      expect(p).toContain(`calculate the percentage increase in the rate of reaction when the ${rise.change}.`)
      expect(b.question.solution).toContain(`at ${rise.from}, $\\dfrac{1000}{${txt(t1!)}} ${r1.exact ? '=' : '\\approx'} ${r1.text}$; at ${rise.to}, $\\dfrac{1000}{${txt(t2!)}} ${r2.exact ? '=' : '\\approx'} ${r2.text}$.`)
      const dp = Math.max(...[r1.text, r2.text].map((v) => (v.split('.')[1] ?? '').length))
      expect(b.question.solution).toContain(`$${r2.text} - ${r1.text} = ${(bb - a).toFixed(dp)}$`)
      expect(b.question.solution).toContain(`which is the percentage fall in **time**`)
      expect(b.question.solution).toContain(String(pct))
      expect(method(b)).toEqual([`converts both times to rates: ${r1.text} and ${r2.text}`, `(${r2.text} − ${r1.text}) ÷ ${r1.text} × 100`])
      expect(last(b)).toBe(`${pct}%`)
      // The fall in time, the increase in rate and the new rate as a percentage are marked wrong.
      expect(mark(b.question, txt(((t1! - t2!) / t1!) * 100)).correct).toBe(false)
      expect(mark(b.question, txt(bb - a)).correct).toBe(false)
      expect(mark(b.question, txt((bb / a) * 100)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(6)
    // Rounded rates as well as exact ones.
    expect(built.some((b) => !rate1000(b.values.t1 as number).exact)).toBe(true)
    spread('enzyme-rate-increase', 'q26', ['t1', 't2'])
  })

  it('q26: the written build, literally', () => {
    const b = build('enzyme-rate-increase', 'q26', 40000, 'literal').find((x) => x.values.context === 'amylase 30 to 40 °C' && x.values.t1 === 50 && x.values.t2 === 20 && x.question.prompt.startsWith('In the amylase and starch test'))!
    expect(b.question.prompt).toBe(
      'In the amylase and starch test, the iodine stopped turning blue-black after 50 s at 30 °C and after 20 s at 40 °C. Using rate = 1000 ÷ time in seconds, calculate the percentage increase in the rate of reaction when the temperature was raised from 30 °C to 40 °C.',
    )
    expect(b.question.solution).toContain('at 30 °C, $\\dfrac{1000}{50} = 20$; at 40 °C, $\\dfrac{1000}{20} = 50$. The increase is $50 - 20 = 30$, and as a percentage of the original rate, $\\dfrac{30}{20} \\times 100 = 150\\%$.')
    expect(answer(b)).toBe(150)
  })
})

// =============================================================================================
// Calorimetry
// =============================================================================================

const FOOD_OF = (noun: string) => BIOENERGETICS.FOODS.find((f) => f.noun === noun)!

describe('food tests and calorimetry', () => {
  it('q6 and q25: water × 4.2 × rise, ÷ the food\'s mass, a lab value below the packet\'s', () => {
    for (const slot of ['q6', 'q25']) {
      const built = build('calorimetry-per-gram', slot)
      for (const b of built) {
        const p = b.question.prompt
        const noun = /per gram of (.+?), in J\/g/.exec(p)![1]!
        const f = FOOD_OF(noun)
        expect(b.values.context).toBe(f.name)
        const m = num(/(\d+(?:\.\d+)?) g of /, p)
        const V = num(/(\d+) cm³ of water/, p)
        let dT: number
        if (slot === 'q25') {
          const [s, e] = nums(/(\d+) °C/g, p)
          dT = e! - s!
          expect(within(s!, 14, 22)).toBe(true)
          expect(p).toContain(`under a boiling tube containing ${V} cm³ of water`)
          expect(p).toMatch(/Use energy transferred \(J\) = mass of water \(g\) × 4\.2 × temperature rise \(°C\); 1 cm³ of water has a mass of 1 g\.$/)
          expect(V).toBeLessThanOrEqual(40)
          expect(b.question.solution).toContain(`Temperature rise $= ${e} - ${s} = ${dT}$ °C, and ${V} cm³ of water has a mass of **${V} g**.`)
        } else {
          dT = num(/by (\d+) °C/, p)
        }
        const E = (V * 42 * dT) / 10
        const L = c(E / m)
        expect(answer(b)).toBe(L)
        expect(Number.isInteger(L) && sigFigures(L) <= 3).toBe(true)
        // Never the 4.2 with the point moved, doubled or halved (4200, 8400, 2100 J/g).
        expect(echoes(L, 4.2)).toBe(false)
        expect(f.masses.map(txt)).toContain(txt(m))
        expect(within(V, 15, 50) && within(dT, 5, 60)).toBe(true)
        // Below the packet's value: 15 to 55% of it, as a simple calorimeter reads.
        expect(within(L, 0.15 * f.packet[0] * 10, 0.55 * f.packet[1] * 10)).toBe(true)
        expect(b.question.solution).toContain(`${V} \\times 4.2 \\times ${dT} = ${texed(E)}`)
        expect(b.question.solution).toContain(`\\dfrac{${texed(E)}}{${txt(m)}}`)
        expect(b.question.solution).toContain(String(L))
        expect(method(b)).toEqual(
          slot === 'q25'
            ? [`temperature rise ${dT} °C, and energy = ${V} × 4.2 × ${dT} = ${prosed(E)} J`, `divides by ${txt(m)} g, the mass of the food`]
            : [`uses mass of water × 4.2 × temperature rise: ${V} × 4.2 × ${dT} = ${prosed(E)} J`, `divides by ${txt(m)} g, the mass of the food`],
        )
        expect(last(b)).toBe(`${prosed(L)} J/g`)
        expect(tolerance(b)).toBe(0)
        // The energy alone, and multiplying by the mass, are marked wrong.
        expect(mark(b.question, String(E)).correct).toBe(false)
        expect(mark(b.question, txt(E * m)).correct).toBe(false)
      }
      expect(contexts(built)).toBe(8)
      spread('calorimetry-per-gram', slot, ['V', 'dT', 'm'])
    }
  })

  it('q6: the written figures, literally', () => {
    const b = build('calorimetry-per-gram', 'q6', 3000, 'literal').find((x) => x.values.V === 50 && x.values.dT === 20 && x.values.m === 0.8 && x.question.prompt.startsWith('Burning'))!
    expect(b.question.prompt).toMatch(/^Burning 0\.8 g of .+ raised the temperature of 50 cm³ of water by 20 °C\./)
    expect(b.question.solution).toBe('Energy: $50 \\times 4.2 \\times 20 = 4200$ J. Per gram: $\\dfrac{4200}{0.8} = 5250$ J/g.')
  })

  it('q15: the food with less per gram releases more joules, and the ratio is the richer over the poorer', () => {
    const built = build('calorimetry-food-comparison', 'q15')
    let richA = 0
    for (const b of built) {
      const p = b.question.prompt
      const x = BIOENERGETICS.MATCHUPS.find((y) => y.name === b.values.context)!
      const [eA, eB] = nums(/gives ([\d ]+) J/g, p)
      const [mA, mB] = nums(/from (\d+(?:\.\d+)?) g/g, p)
      const pA = c(eA! / mA!)
      const pB = c(eB! / mB!)
      const claimed = /says Food (A|B) contains more energy/.exec(p)![1]!
      const [, asked, than] = /how many times more energy per gram Food (A|B) contains than Food (A|B)\./.exec(p)!
      const [rich, poor, eRich, ePoor] = pA > pB ? ['A', 'B', eA!, eB!] : ['B', 'A', eB!, eA!]
      if (rich === 'A') richA++
      expect(asked).toBe(rich)
      expect(than).toBe(poor)
      // The student's claim: the poorer food released more joules.
      expect(claimed).toBe(poor)
      expect(ePoor).toBeGreaterThan(eRich)
      const k = c(Math.max(pA, pB) / Math.min(pA, pB))
      expect(answer(b)).toBe(k)
      // Exact to 2 places, at least 1.2, and 0.8 to 1.3 times the packets' own ratio (middle to middle).
      const packet = (x.rich.packet[0] + x.rich.packet[1]) / (x.poor.packet[0] + x.poor.packet[1])
      expect(tidy(k, 2)).toBe(true)
      expect(within(k, Math.max(1.2, 0.8 * packet), 1.3 * packet), `${b.seed}: ${k} against the packets' ${packet.toFixed(2)}`).toBe(true)
      for (const e of [eA!, eB!]) expect(echoes(k, e)).toBe(false)
      expect(p).toContain(`${rich === 'A' ? x.richPiece : x.poorPiece} (Food A)`)
      expect(within(Math.max(pA, pB), ...BIOENERGETICS.labRange(x.rich))).toBe(true)
      expect(within(Math.min(pA, pB), ...BIOENERGETICS.labRange(x.poor))).toBe(true)
      expect(x.rich.masses.map(txt)).toContain(txt(rich === 'A' ? mA! : mB!))
      expect(x.poor.masses.map(txt)).toContain(txt(rich === 'A' ? mB! : mA!))
      for (const e of [eA!, eB!]) expect(within(e, 500, 10000)).toBe(true)
      expect(b.question.solution).toContain(`Food A: $\\dfrac{${texed(eA!)}}{${txt(mA!)}} = ${texed(pA)}$ J/g. Food B: $\\dfrac{${texed(eB!)}}{${txt(mB!)}} = ${texed(pB)}$ J/g. Then $\\dfrac{${texed(Math.max(pA, pB))}}{${texed(Math.min(pA, pB))}} = ${txt(k)}$.`)
      expect(method(b)).toEqual([`finds ${prosed(pA)} J/g for Food A`, `finds ${prosed(pB)} J/g for Food B`])
      expect(last(b)).toBe(`${txt(k)} times`)
      expect(tolerance(b)).toBe(half(2, k))
      // The raw joules compared either way are marked wrong.
      expect(mark(b.question, txt(ePoor / eRich)).correct).toBe(false)
      expect(mark(b.question, txt(eRich / ePoor)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    expect(richA / built.length).toBeGreaterThan(0.4)
    expect(richA / built.length).toBeLessThan(0.6)
    spread('calorimetry-food-comparison', 'q15', ['pR', 'pP', 'mR', 'mP'])
  })

  it('q26: the lab value as a percentage of a real packet value', () => {
    const built = build('calorimetry-packet-percentage', 'q26')
    for (const b of built) {
      const p = b.question.prompt
      const noun = / g of (.+?) under a boiling tube/.exec(p)![1]!
      const f = FOOD_OF(noun)
      expect(p.startsWith(f.packetText)).toBe(true)
      const P = num(/contains? (\d+) kJ per 100 g/, p)
      expect(within(P, ...f.packet) && P % 10 === 0).toBe(true)
      const m = num(/burns (\d+(?:\.\d+)?) g/, p)
      const V = num(/(\d+) cm³ of water/, p)
      const [s, e] = nums(/(\d+) °C/g, p)
      const dT = e! - s!
      const E = (V * 42 * dT) / 10
      const L = c(E / m)
      const pct = c((L / (P * 10)) * 100)
      expect(answer(b)).toBe(pct)
      expect(within(pct, 15, 55)).toBe(true)
      expect(tidy(pct, 1)).toBe(true)
      expect(f.masses.map(txt)).toContain(txt(m))
      expect(b.question.solution).toContain(`Temperature rise $= ${e} - ${s} = ${dT}$ °C. Energy transferred to the water $= ${V} \\times 4.2 \\times ${dT} = ${texed(E)}$ J. Per gram of ${f.noun}: $\\dfrac{${texed(E)}}{${txt(m)}} = ${texed(L)}$ J/g.`)
      expect(b.question.solution).toContain(`${P} kJ per 100 g is $${texed(P * 1000)}$ J per 100 g, which is $${texed(P * 10)}$ J/g.`)
      expect(b.question.solution).toContain(`$\\dfrac{${texed(L)}}{${texed(P * 10)}} \\times 100 = ${txt(pct)}$ %. The other ${txt(100 - pct)} % was lost`)
      expect(method(b)).toEqual([`energy = ${V} × 4.2 × ${dT} = ${prosed(E)} J, so ${prosed(L)} J/g`, `converts ${P} kJ per 100 g to ${prosed(P * 10)} J/g and divides`])
      expect(last(b)).toBe(`${txt(pct)} %`)
      expect(tolerance(b)).toBe(half(places(pct), pct))
      // Forgetting kJ → J, or per 100 g → per g, moves the point and is marked wrong.
      expect(mark(b.question, txt(pct * 10)).correct).toBe(false)
      expect(mark(b.question, txt(pct / 10)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(8)
    spread('calorimetry-packet-percentage', 'q26', ['P', 'V', 'dT', 'm', 'start'])
  })
})

// =============================================================================================
// Photosynthesis
// =============================================================================================

describe('photosynthesis and limiting factors', () => {
  it('q7: bubbles ÷ minutes, at the rate the set-up gives', () => {
    const built = build('photosynthesis-bubble-rate', 'q7')
    for (const b of built) {
      const w = BIOENERGETICS.WEEDS.find((x) => x.name === b.values.context)!
      expect(b.question.prompt.startsWith(w.text)).toBe(true)
      const [n, t] = /(\d+) bubbles of oxygen in (\d+) minutes/.exec(b.question.prompt)!.slice(1).map(Number)
      const R = c(n! / t!)
      expect(answer(b)).toBe(R)
      expect(tidy(R, 1) && within(R, ...w.rate)).toBe(true)
      expect([3, 4, 5, 6, 8]).toContain(t)
      expect(b.question.solution).toBe(`Rate = number ÷ time = ${n} ÷ ${t} = ${txt(R)} bubbles per minute.`)
      expect(method(b)).toEqual([`${n} ÷ ${t}`])
      expect(last(b)).toBe(`${txt(R)} bubbles per minute`)
      expect(tolerance(b)).toBe(half(places(R), R))
    }
    expect(contexts(built)).toBe(4)
    spread('photosynthesis-bubble-rate', 'q7', ['n', 't'])
  })

  it('q9: doubling, tripling, halving or a third of the distance, by the square', () => {
    const built = build('photosynthesis-lamp-moved', 'q9')
    let up = 0
    for (const b of built) {
      const p = b.question.prompt
      const [d1, d2] = nums(/(\d+) cm/g, p)
      const R = num(/(\d+) bubbles/, p)
      const f = d2! / d1!
      expect([2, 3, 0.5, 1 / 3].some((x) => Math.abs(x - f) < 1e-9)).toBe(true)
      const A = c(R * (d1! / d2!) ** 2)
      expect(answer(b)).toBe(A)
      if (A > R) up++
      expect(within(d1!, 10, 100) && within(d2!, 10, 100) && within(R, 2, 100) && within(A, 2, 100)).toBe(true)
      // No rate is a distance.
      for (const x of [R, A]) expect([d1, d2]).not.toContain(x)
      expect(tidy(A, 1)).toBe(true)
      expect(p).toMatch(/assuming light is the limiting factor throughout|Assuming light is the limiting factor throughout/)
      const n = Math.round(f > 1 ? f * f : 1 / (f * f))
      expect(b.question.solution).toContain(f > 1 ? `$${R} \\div ${n} = ${txt(A)}$` : `$${R} \\times ${n} = ${txt(A)}$`)
      expect(b.question.solution).toContain(`$${n === 4 ? 2 : 3}^2 = ${n}$`)
      expect(method(b)[0]).toMatch(new RegExp(`^${R} ${f > 1 ? '÷' : '×'} ${n}, because `))
      expect(last(b)).toBe(txt(A))
      // Halving instead of quartering (the distance's factor, not its square) is marked wrong.
      expect(mark(b.question, txt(R * (d1! / d2!))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    expect(up / built.length).toBeGreaterThan(0.4)
    expect(up / built.length).toBeLessThan(0.6)
    spread('photosynthesis-lamp-moved', 'q9', ['d1', 'R'])
  })

  it('q10: 1/d² to 2 significant figures, clear of a half and never ending in 0', () => {
    const built = build('photosynthesis-inverse-square', 'q10')
    for (const b of built) {
      const d = num(/(\d+) cm from/, b.question.prompt)
      const exact = 1 / (d * d)
      const a = Number(exact.toPrecision(2))
      expect(answer(b)).toBe(a)
      expect(within(d, 5, 100)).toBe(true)
      expect(exact.toPrecision(2).endsWith('0')).toBe(false)
      expect(b.question.prompt).toMatch(/Calculate 1\/d², where d is the distance in cm\. Give your answer as a decimal to 2 significant figures\.$/)
      expect(b.question.solution).toContain(`d² = ${d} × ${d} = ${d * d}, so 1/d² = 1 ÷ ${d * d} = `)
      expect(b.question.solution).toContain(String(a))
      expect(method(b)).toEqual([`${d}² = ${d * d}`])
      expect(last(b)).toBe(String(a))
      const tol = Number(Math.min(0.5 * 10 ** (Math.floor(Math.log10(a)) - 1), a * 0.019).toPrecision(10))
      expect(tolerance(b)).toBe(tol)
      // The exact value is marked right; 1/d (forgetting the square) is not.
      expect(mark(b.question, String(exact)).correct).toBe(true)
      expect(mark(b.question, String(1 / d)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(3)
    spread('photosynthesis-inverse-square', 'q10', ['d'])
    const written = build('photosynthesis-inverse-square', 'q10', 1500, 'literal').find((x) => x.values.d === 25)!
    expect(written.question.solution).toBe('d² = 25 × 25 = 625, so 1/d² = 1 ÷ 625 = 0.0016.')
    const cut = build('photosynthesis-inverse-square', 'q10', 1500, 'literal').find((x) => x.values.d === 30)!
    expect(cut.question.solution).toBe('d² = 30 × 30 = 900, so 1/d² = 1 ÷ 900 = 0.001111…, which is 0.0011 to 2 significant figures.')
  })

  it('q15: (new − old) ÷ old × 100, an increase', () => {
    const built = build('photosynthesis-percentage-increase', 'q15')
    for (const b of built) {
      const boost = BIOENERGETICS.BOOSTS.find((x) => x.name === b.values.context)!
      const [a, n] = /rose from (\d+) to (\d+) bubbles per minute/.exec(b.question.prompt)!.slice(1).map(Number)
      const pct = c(((n! - a!) / a!) * 100)
      expect(answer(b)).toBe(pct)
      expect(b.question.prompt.startsWith(boost.when)).toBe(true)
      expect(within(pct, ...boost.pct) && tidy(pct, 1) && pct !== 100).toBe(true)
      // A rise of more than 1 bubble, and no rate that is a temperature printed beside it.
      expect(n! - a!).toBeGreaterThanOrEqual(2)
      for (const f of boost.figures) expect([a, n]).not.toContain(f)
      expect(b.question.solution).toBe(`Increase = ${n} − ${a} = ${n! - a!}. Percentage increase = ${n! - a!} ÷ ${a} × 100 = ${txt(pct)}%.`)
      expect(method(b)).toEqual([`(${n} − ${a}) ÷ ${a}`])
      expect(last(b)).toBe(`${txt(pct)}%`)
      expect(tolerance(b)).toBe(half(places(pct), pct))
      // The change alone, and dividing by the new rate, are marked wrong.
      expect(mark(b.question, String(n! - a!)).correct).toBe(false)
      expect(mark(b.question, txt(((n! - a!) / n!) * 100)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    spread('photosynthesis-percentage-increase', 'q15', ['a', 'b'])
  })

  it('q24: a gas syringe volume ÷ minutes × 60', () => {
    const built = build('photosynthesis-oxygen-per-hour', 'q24')
    for (const b of built) {
      const s = BIOENERGETICS.SYRINGES.find((x) => x.name === b.values.context)!
      const [v, t] = /: (\d+(?:\.\d+)?) cm³ of oxygen is collected in (\d+) minutes/.exec(b.question.prompt)!.slice(1).map(Number)
      const rate = c((v! * 60) / t!)
      expect(answer(b)).toBe(rate)
      expect(tidy(rate, 1) && within(rate, ...s.rate)).toBe(true)
      expect([6, 30, 60]).not.toContain(t)
      // Never 1 cm³, and at least half a cubic centimetre in the dim set-up.
      expect(v).not.toBe(1)
      expect(v!).toBeGreaterThanOrEqual(s.name === 'dim' ? 0.5 : 0.2)
      expect(b.question.solution).toContain(`In ${t} minutes, ${txt(v!)} cm³ was collected, so the rate is $\\dfrac{${txt(v!)}}{${t}}`)
      expect(b.question.solution).toContain(`= ${txt(rate)}$ cm³ per hour.`)
      const lots = 60 / t!
      if (Number.isInteger(lots)) expect(b.question.solution).toContain(`an hour is ${lots} lots of ${t} minutes, so $${txt(v!)} \\times ${lots} = ${txt(rate)}$`)
      expect(method(b)).toEqual([`divides ${txt(v!)} by ${t} and scales to an hour (×60)${Number.isInteger(lots) ? `, or multiplies ${txt(v!)} by ${lots}` : ''}`])
      expect(last(b)).toBe(`${txt(rate)} cm³ per hour`)
      expect(tolerance(b)).toBe(half(places(rate), rate))
      // The per-minute rate is marked wrong.
      expect(mark(b.question, txt(v! / t!)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(3)
    spread('photosynthesis-oxygen-per-hour', 'q24', ['v', 't'])
  })

  it('q25: the square of the distance ratio, against the student\'s straight proportion', () => {
    const built = build('photosynthesis-inverse-square-prediction', 'q25')
    const WORDS: Record<string, number> = {
      'two thirds of': 2 / 3, 'three quarters of': 3 / 4, 'three fifths of': 3 / 5, 'four fifths of': 4 / 5, 'two fifths of': 2 / 5,
      'one and a half times': 3 / 2, 'one and a third times': 4 / 3, 'one and a quarter times': 5 / 4, 'two and a half times': 5 / 2,
    }
    let away = 0
    for (const b of built) {
      const p = b.question.prompt
      const d1 = num(/lamp (\d+) cm from pondweed/, p)
      const d2 = num(/moved to (\d+) cm/, p)
      const R = num(/counts (\d+) bubbles/, p)
      const W = num(/predicts (\d+(?:\.\d+)?) bubbles/, p)
      const words = new RegExp(`reasoning that ${d1} cm is (.+?) ${d2} cm\\.`).exec(p)![1]!
      expect(Math.abs(WORDS[words]! - d1 / d2)).toBeLessThan(1e-9)
      expect(W).toBe(c((R * d1) / d2))
      const A = c(R * (d1 / d2) ** 2)
      expect(answer(b)).toBe(A)
      if (d2 > d1) away++
      expect(b.values.context).toBe(d2 > d1 ? 'away' : 'closer')
      for (const d of [d1, d2]) expect(d % 5 === 0 && within(d, 5, 100)).toBe(true)
      for (const x of [R, W, A]) expect(within(x, 2, 100)).toBe(true)
      expect(tidy(A, 1) && tidy(W, 1)).toBe(true)
      expect(b.question.solution).toContain(`$\\left(\\dfrac{${d1}}{${d2}}\\right)^2 = \\dfrac{${d1 * d1}}{${d2 * d2}} = `)
      expect(b.question.solution).toContain(`$${R} \\times \\dfrac{${d1 * d1}}{${d2 * d2}} = ${txt(A)}$`)
      expect(b.question.solution).toContain(d2 > d1 ? 'The rate falls as the distance rises' : 'The rate rises as the distance falls')
      expect(method(b)[0]).toBe(`uses rate proportional to 1/d²: the intensity ratio is (${d1}/${d2})² = ${d1 * d1}/${d2 * d2}, or 1/${d1 * d1} against 1/${d2 * d2}`)
      expect(method(b)[1]).toMatch(new RegExp(`^multiplies ${R} by `))
      expect(last(b)).toBe(`${txt(A)} bubbles per minute`)
      expect(tolerance(b)).toBe(half(places(A), A))
      // The student's prediction is marked wrong.
      expect(mark(b.question, txt(W)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(2)
    expect(away / built.length).toBeGreaterThan(0.4)
    expect(away / built.length).toBeLessThan(0.6)
    spread('photosynthesis-inverse-square-prediction', 'q25', ['ratio', 'd1', 'R'])
  })

  it('q25: the written build, literally', () => {
    const b = build('photosynthesis-inverse-square-prediction', 'q25', 3000, 'literal').find((x) => x.values.d1 === 15 && x.values.d2 === 20 && x.values.R === 32)!
    expect(b.question.prompt).toBe(
      'With a lamp 15 cm from pondweed, a student counts 32 bubbles per minute. The lamp is moved to 20 cm. The student predicts 24 bubbles per minute, reasoning that 15 cm is three quarters of 20 cm. Light intensity is proportional to 1/d², where d is the distance from the lamp, and light is the limiting factor throughout. Calculate the rate the student should actually predict.',
    )
    expect(b.question.solution).toContain('$\\left(\\dfrac{15}{20}\\right)^2 = \\dfrac{225}{400} = 0.5625$, not by $\\dfrac{15}{20} = 0.75$. So the predicted rate is $32 \\times 0.5625 = 18$ bubbles per minute.')
    expect(method(b)[1]).toBe('multiplies 32 by 0.5625 (or by 225/400)')
  })
})

// =============================================================================================
// Respiration
// =============================================================================================

const RESPIRER = (b: Generated) => BIOENERGETICS.RESPIRERS.find((x) => x.name === b.values.context)!

describe('aerobic and anaerobic respiration', () => {
  it('q6: drop distance ÷ minutes, at the speed the organisms really move it', () => {
    const built = build('respirometer-rate', 'q6')
    for (const b of built) {
      const x = RESPIRER(b)
      const p = b.question.prompt
      expect(p).toContain(x.text)
      const T = num(/at (\d+) °C/, p)
      const [D, t] = /mov(?:ed|es) (\d+) mm in (\d+) minutes/.exec(p)!.slice(1).map(Number)
      const R = c(D! / t!)
      expect(answer(b)).toBe(R)
      const [lo, hi] = T === x.temps[0] ? x.cool : BIOENERGETICS.warmRange(x)
      expect(x.temps).toContain(T)
      expect(within(R, lo, hi) && tidy(R, 1)).toBe(true)
      expect([2, 10]).not.toContain(t)
      expect(b.question.solution).toBe(`$\\dfrac{${D}}{${t}} = ${txt(R)}$ mm/min.`)
      expect(method(b)).toEqual(['divides the distance by the time'])
      expect(last(b)).toBe(`${txt(R)} mm/min`)
      expect(tolerance(b)).toBe(half(places(R), R))
    }
    expect(contexts(built)).toBe(4)
    spread('respirometer-rate', 'q6', ['D', 't'])
  })

  it('q16: both rates, then the warm over the cool, to 2 decimal places; the distances mislead', () => {
    const built = build('respirometer-comparison', 'q16')
    for (const b of built) {
      const x = RESPIRER(b)
      const p = b.question.prompt
      const [D1, D2] = nums(/moved (\d+) mm/g, p)
      const [t1, t2] = nums(/mm in (\d+) minutes/g, p)
      const r1 = c(D1! / t1!)
      const r2 = c(D2! / t2!)
      const exact = r2 / r1
      const k = Number(exact.toFixed(2))
      expect(answer(b)).toBe(k)
      expect(within(r1, ...x.cool) && within(r2, ...BIOENERGETICS.warmRange(x))).toBe(true)
      expect(within(exact, 1.3, 2.5)).toBe(true)
      expect(Math.abs(exact * 100 - Math.floor(exact * 100) - 0.5)).toBeGreaterThan(0.05)
      // The student's claim matches the distances, and is at least 0.3 from the truth.
      const [, how, many] = /respired (almost|just over) (twice|three times) as fast, because/.exec(p)!
      const n = many === 'twice' ? 2 : 3
      const dist = D2! / D1!
      expect(how === 'almost' ? dist < n && dist >= n * 0.875 : dist > n && dist <= n * 1.1).toBe(true)
      expect(p).toContain(`because ${D2} mm is ${how} ${many} ${D1} mm.`)
      expect(Math.abs(exact - n)).toBeGreaterThanOrEqual(0.3)
      // The warm reading is timed for longer, as in the written question, so the raw distances
      // overstate the difference and "almost twice" overstates it, as the solution says.
      expect(t2!).toBeGreaterThan(t1!)
      expect(dist).toBeGreaterThan(exact)
      expect(b.question.solution).toContain('would have suggested a much larger difference')
      // No distance or time is a temperature, nor one with the point moved.
      for (const v of [D1!, D2!, t1!, t2!]) for (const T of x.temps) expect(isPowerOfTen(v / T)).toBe(false)
      expect(p).toMatch(/to two decimal places/)
      expect(b.question.solution).toContain(`Rates are $\\dfrac{${D1}}{${t1}} = ${txt(r1)}$ mm/min and $\\dfrac{${D2}}{${t2}} = ${txt(r2)}$ mm/min, so $\\dfrac{${txt(r2)}}{${txt(r1)}} = `)
      expect(method(b)).toEqual([`converts both readings to rates: ${txt(r1)} and ${txt(r2)} mm/min`, `divides ${txt(r2)} by ${txt(r1)}`])
      expect(last(b)).toBe(k.toFixed(2))
      expect(tolerance(b)).toBe(half(2, k))
      // The exact ratio is marked right; the raw distance ratio is not.
      expect(mark(b.question, String(exact)).correct).toBe(true)
      expect(mark(b.question, dist.toFixed(2)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    spread('respirometer-comparison', 'q16', ['D1', 't1', 'D2', 't2'])
  })

  it('q16: the written build\'s shape, literally', () => {
    const b = build('respirometer-comparison', 'q16', 3000, 'literal').find((x) => !Number.isInteger(answer(x) * 10))!
    expect(b.question.solution).toMatch(/= \d\.\d{3}\\ldots\$, which is \*\*\d\.\d\d\*\* to two decimal places\./)
  })

  it('q25: the mean of three close counts, ÷ the minutes', () => {
    const built = build('yeast-bubble-rate', 'q25')
    for (const b of built) {
      const brew = BIOENERGETICS.BREWS.find((x) => x.name === b.values.context)!
      const p = b.question.prompt
      expect(p).toContain(`${brew.T} °C`)
      const counts = /give (\d+), (\d+) and (\d+) bubbles/.exec(p)!.slice(1).map(Number)
      const t = num(/in (\d+) minutes/, p)
      const sum = counts[0]! + counts[1]! + counts[2]!
      expect(sum % 3).toBe(0)
      const mean = sum / 3
      const R = c(mean / t)
      expect(answer(b)).toBe(R)
      // The written 45, 51 and 48 run 12.5% of their mean: at most 15% here, or 3 bubbles for small counts.
      const range = Math.max(...counts) - Math.min(...counts)
      expect(range).toBeGreaterThan(0)
      expect(range).toBeLessThanOrEqual(Math.max(0.15 * mean, 3))
      expect(within(R, ...brew.rate) && tidy(R, 2)).toBe(true)
      expect(b.question.solution).toContain(`Mean count $= \\dfrac{${counts.join(' + ')}}{3} = \\dfrac{${sum}}{3} = ${mean}$ bubbles in ${t} minutes. Rate $= \\dfrac{${mean}}{${t}} = ${txt(R)}$ bubbles per minute.`)
      expect(method(b)).toEqual([`mean of the three counts = ${mean}`, `divides by the ${t} minutes`])
      expect(last(b)).toBe(`${txt(R)} bubbles per minute`)
      expect(tolerance(b)).toBe(half(places(R), R))
      // Stopping at the mean count is marked wrong.
      expect(mark(b.question, String(mean)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    spread('yeast-bubble-rate', 'q25', ['c1', 'm', 't'])
  })

  it('q26: the control subtracted where it moved, then the increase over the cool rate', () => {
    const built = build('respirometer-control', 'q26')
    let warmControl = 0
    for (const b of built) {
      const x = RESPIRER(b)
      const p = b.question.prompt
      const [D1, D2] = nums(/the drop moved (\d+) mm/g, p)
      const [t1, t2] = nums(/mm in (\d+) minutes/g, p)
      const cMove = num(/control tube of glass beads moved (\d+) mm in the same direction/, p)
      const parts = p.split(`At ${x.temps[1]} °C`)
      const at = parts[0]!.includes('moved ' + cMove + ' mm in the same direction') ? 1 : 2
      if (at === 2) warmControl++
      expect(parts[at === 1 ? 1 : 0]).toContain('did not move')
      const r1 = c((D1! - (at === 1 ? cMove : 0)) / t1!)
      const r2 = c((D2! - (at === 2 ? cMove : 0)) / t2!)
      const pct = c(((r2 - r1) / r1) * 100)
      const raw = ((D2! / t2! - D1! / t1!) / (D1! / t1!)) * 100
      expect(answer(b)).toBe(pct)
      expect(cMove).toBeGreaterThanOrEqual(2)
      expect(cMove).toBeLessThanOrEqual((at === 1 ? D1! : D2!) / 5)
      expect(within(r1, ...x.cool) && within(r2, ...BIOENERGETICS.warmRange(x))).toBe(true)
      expect(within(r2 / r1, 1.3, 2.5) && tidy(pct, 1) && pct !== 100).toBe(true)
      expect(Math.abs(raw - pct)).toBeGreaterThanOrEqual(5)
      expect(p).toContain(`between ${x.temps[0]} °C and ${x.temps[1]} °C.`)
      const D = at === 1 ? D1! : D2!
      expect(b.question.solution).toContain(`so it is subtracted. $${D} - ${cMove} = ${D - cMove}$ mm, and the rate is $\\dfrac{${D - cMove}}{${at === 1 ? t1 : t2}} = ${txt(at === 1 ? r1 : r2)}$ mm/min`)
      expect(b.question.solution).toContain(`the control did not move, so the rate is $\\dfrac{${at === 1 ? D2 : D1}}{${at === 1 ? t2 : t1}} = ${txt(at === 1 ? r2 : r1)}$ mm/min`)
      expect(b.question.solution).toContain(`The increase is $${txt(r2)} - ${txt(r1)} = ${txt(r2 - r1)}$ mm/min, and $\\dfrac{${txt(r2 - r1)}}{${txt(r1)}} \\times 100 = ${txt(pct)}$ %.`)
      expect(method(b)).toEqual([
        at === 2 ? `rates of ${txt(r1)} mm/min and, after subtracting the control, ${txt(r2)} mm/min` : `rates of ${txt(r1)} mm/min after subtracting the control, and ${txt(r2)} mm/min`,
        'increase divided by the original rate, × 100',
      ])
      expect(last(b)).toBe(`${txt(pct)} %`)
      expect(tolerance(b)).toBe(half(places(pct), pct))
      // Ignoring the control, and subtracting it from the wrong reading, are marked wrong.
      expect(mark(b.question, txt(raw)).correct).toBe(false)
      const wrong = at === 1 ? c(((D2! - cMove) / t2! - D1! / t1!) / (D1! / t1!) * 100) : c(((D2! / t2!) - (D1! - cMove) / t1!) / ((D1! - cMove) / t1!) * 100)
      expect(mark(b.question, txt(wrong)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    // Which reading the control corrects: half each, so correcting the warm one by habit pays half the time.
    expect(warmControl / built.length).toBeGreaterThan(0.4)
    expect(warmControl / built.length).toBeLessThan(0.6)
    spread('respirometer-control', 'q26', ['D1', 't1', 'D2', 't2', 'c'])
  })
})
