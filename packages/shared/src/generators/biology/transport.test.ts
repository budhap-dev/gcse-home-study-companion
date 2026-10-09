import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { fixed, show } from '../format.ts'
import { figures } from '../physics/build.ts'
import { sigFigs } from '../physics/format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { clearOf, shiftFree, tenfold } from '../chemistry/build.ts'
import { TRANSPORT, transportGenerators } from './transport.ts'

/**
 * Structural tests for the transport generators. Each reads the prompt's own figures back and
 * works the answer again from them alone, checks every printed step of the working and the mark
 * scheme's method lines, the units the written slot carries, the tolerance rule, that every
 * context turns up and that no answer or input fills a context, and that the biology stays real:
 * potato cylinders of 1 to 5 g gaining in dilute solutions and losing in concentrated ones, cells
 * of their real size, fields of view of a real microscope and a potometer bubble at a real speed.
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

const num = (s: string) => Number(s.replace('−', '-'))
const clean = (x: number) => Number(x.toPrecision(12))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const last = (b: Generated) => b.question.markScheme.at(-1)!.description
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
/** A number in maths as the content prints it: a thin space between groups of three from five digits. */
const g = (x: number) => (x >= 10000 ? show(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : show(x))
const half = (dp: number, x: number) => Number(Math.min(0.5 * 10 ** -dp, Math.abs(x) * 0.019).toPrecision(10))
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

const SLOTS: Record<string, string[]> = {
  'diffusion-osmosis-and-active-transport': ['q14', 'q24', 'q25', 'q5'],
  'exchange-surfaces-and-gas-exchange': ['q12', 'q13', 'q2', 'q20', 'q26', 'q27', 'q5'],
  'leaf-root-and-transport-tissues': ['q13', 'q24', 'q25'],
  'transpiration-and-translocation': ['q13', 'q17', 'q24', 'q25', 'q6', 'q9'],
}

describe('every transport build', () => {
  it('has a generator for every numeric written slot in the four topics', () => {
    for (const [topic, ids] of Object.entries(SLOTS)) {
      expect(bankOf(topic).filter((q) => q.type === 'numeric').map((q) => q.id).sort(), topic).toEqual(ids)
      expect(transportGenerators.filter((g) => g.topicId === topic).flatMap((g) => g.replaces).sort(), topic).toEqual(ids)
    }
  })

  it('prints no article before a figure, keeps the units, reaches its answer and is marked right at three figures', () => {
    for (const g of transportGenerators) {
      for (const id of g.replaces) {
        const slot = bankOf(g.topicId).find((q) => q.id === id)!
        for (const b of build(g.id, id, 150)) {
          const q = b.question
          expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          expect(q.type === 'numeric' && q.units, b.seed).toBe(slot.type === 'numeric' && slot.units)
          expect(q.solution, b.seed).toContain(String(answer(b)))
          expect(mark(q, String(answer(b))).correct, b.seed).toBe(true)
          // A calculated answer the prompt gives no precision for is marked right at three figures.
          // A whole-millimetre cube's area is exact and is not rounded.
          if (!/decimal place/.test(q.prompt) && g.id !== 'cube-surface-area') expect(mark(q, String(sigFigs(answer(b), 3))).correct, `${b.seed} three figures`).toBe(true)
          expect(tolerance(b)).toBeLessThanOrEqual(Math.abs(answer(b)) * 0.02)
          expect(b.check.agrees, b.seed).toBe(true)
        }
      }
    }
  })

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const g of transportGenerators) {
      for (const id of g.replaces) {
        const slot = bankOf(g.topicId).find((q) => q.id === id)!
        expect(() => {
          for (let i = 0; i < 3000; i++) generate(g, slot, `throw-${i}`)
        }, `${g.id} ${id}`).not.toThrow()
      }
    }
  })
})

describe('diffusion, osmosis and active transport', () => {
  it('q5: a potato cylinder of 1 to 5 g gains in dilute solutions and loses in concentrated ones', () => {
    const built = build('osmosis-percentage-change', 'q5')
    for (const b of built) {
      const p = b.question.prompt
      const [m0, m1] = [...p.matchAll(/(\d+\.\d\d) g/g)].map((m) => Number(m[1]))
      const x = clean(((m1! - m0!) / m0!) * 100)
      expect(answer(b)).toBe(x)
      expect(m0! >= 1.2 && m0! <= 5).toBe(true)
      const bath = TRANSPORT.BATHS.find((c) => p.includes(` in ${c.name}`))!
      expect(x >= bath.change[0] && x <= bath.change[1]).toBe(true)
      expect(Math.sign(x)).toBe(bath.name === 'distilled water' || bath.name.startsWith('0.1') ? 1 : -1)
      expect(p).toMatch(/Give your answer including the sign\.$/)
      expect(b.question.solution).toContain(`Change $= ${fixed(m1!, 2)} - ${fixed(m0!, 2)} = ${fixed(m1! - m0!, 2)}$ g.`)
      expect(b.question.solution).toContain(`\\dfrac{${fixed(m1! - m0!, 2)}}{${fixed(m0!, 2)}} \\times 100 = ${show(x)}\\%`)
      expect(b.question.solution).toContain(x > 0 ? 'water moved **in**' : 'water moved **out**')
      expect(method(b)).toEqual(['divides the change by the original mass'])
      expect(last(b)).toBe(`${show(x)}%`)
      expect(tolerance(b)).toBe(half(1, x))
      // The change alone, and the percentage without its sign, are marked wrong.
      expect(mark(b.question, String(clean(m1! - m0!))).correct).toBe(false)
      expect(mark(b.question, String(-x)).correct).toBe(false)
      expect(shiftFree(Math.abs(x), m0!, m1!, Math.abs(m1! - m0!))).toBe(true)
    }
    expect(contexts(built)).toBe(4)
    // A minus pays about half the time.
    const negatives = built.filter((b) => answer(b) < 0).length / built.length
    expect(negatives > 0.4 && negatives < 0.6).toBe(true)
    spread('osmosis-percentage-change', 'q5', ['m0', 'm1'])
  })

  it('q5 and q24: literal builds, as a reader works them', () => {
    const g = GENERATORS.find((x) => x.id === 'osmosis-percentage-change')!
    const loss = generate(g, bankOf(g.topicId).find((q) => q.id === 'q5')!, 'review-b')
    expect(loss.question.prompt).toBe(
      'A student weighs a potato cylinder at 3.75 g, leaves it in 1.0 mol/dm³ sucrose solution for an hour, then blots it dry and weighs it again at 3.36 g. Calculate the percentage change in mass. Give your answer including the sign.',
    )
    expect(loss.question.solution).toBe(
      'Change $= 3.36 - 3.75 = -0.39$ g. $\\dfrac{-0.39}{3.75} \\times 100 = -10.4\\%$. Negative, so water moved **out** by osmosis and the solution was **more concentrated** than the cell contents.',
    )
    expect(answer(loss)).toBe(-10.4)
    const mean = build('osmosis-mean-change', 'q24', 3000, 'literal').find((b) => [b.values.r1, b.values.r2, b.values.r3].some((r) => Number.isInteger(r)))!
    // A whole-number reading still prints its tenths, as a results table does: +10.0, not +10.
    expect(mean.question.prompt).toMatch(/[+−]\d+\.0%/)
  })

  it('q14: the same change on two masses, as a ratio to one decimal place', () => {
    const built = build('osmosis-percentage-comparison', 'q14')
    for (const b of built) {
      const p = b.question.prompt
      const g = Number(/A (?:gains|loses) (\d\.\d\d) g/.exec(p)![1])
      expect(p).toContain(`B ${b.values.context === 'gain' ? 'gains' : 'loses'} ${fixed(g, 2)} g`)
      const [a, bb] = [...p.matchAll(/starting mass of (\d\.\d\d) g/g)].map((m) => Number(m[1]))
      const pA = clean((g / a!) * 100)
      const pB = clean((g / bb!) * 100)
      const exact = pA / pB
      const k = Number(exact.toFixed(1))
      expect(answer(b)).toBe(k)
      // Clear of a half at 1 decimal place, so rounding the printed percentages cannot tip it.
      expect(Math.abs((((bb! / a!) * 10) % 1) - 0.5)).toBeGreaterThan(0.1)
      expect(a! >= 1 && bb! <= 5).toBe(true)
      expect(Number.isInteger(k)).toBe(false)
      expect(Math.round(k * 10) % 10).not.toBe(1)
      const times = ['', '', 'twice', 'three times', 'four times'][Math.floor(exact)]!
      expect(Math.floor(k)).toBe(Math.floor(exact))
      expect(p).toContain(`is more than ${times} the`)
      expect(p).toMatch(/to one decimal place\.$/)
      expect(b.question.solution).toContain(`\\dfrac{${fixed(g, 2)}}{${fixed(a!, 2)}} \\times 100 = ${show(pA)}\\%`)
      expect(b.question.solution).toContain(`\\dfrac{${fixed(g, 2)}}{${fixed(bb!, 2)}} \\times 100 = ${show(pB)}\\%`)
      expect(b.question.solution).toContain(`$${show(pA)} \\div ${show(pB)} = `)
      expect(b.question.solution).toContain(`= ${show(k)}$`)
      expect(b.question.solution).toContain(`**${show(k)} times**`)
      expect(method(b)).toEqual([`finds ${show(pA)}% for A`, `finds ${show(pB)}% for B`])
      expect(last(b)).toBe(`${show(k)} times`)
      expect(tolerance(b)).toBe(half(1, k))
      expect(pA).toBeLessThanOrEqual(30)
      // The raw change ratio (1) and the difference in percentages are marked wrong.
      expect(mark(b.question, String(clean(pA - pB))).correct).toBe(false)
      expect(clearOf(k, a!, bb!, g, pA, pB)).toBe(true)
    }
    expect(contexts(built)).toBe(2)
    spread('osmosis-percentage-comparison', 'q14', ['a', 'b', 'g'])
  })

  it('q24: the mean of three signed repeats, the sign kept', () => {
    const built = build('osmosis-mean-change', 'q24')
    for (const b of built) {
      const p = b.question.prompt
      const rs = [...p.matchAll(/([+−]\d+\.\d)%/g)].map((m) => num(m[1]!))
      expect(rs).toHaveLength(3)
      const m = clean((rs[0]! + rs[1]! + rs[2]!) / 3)
      expect(answer(b)).toBe(m)
      const c = TRANSPORT.REPEATS.find((x) => p.includes(` in ${x.name} `))!
      expect(m >= c.mean[0] && m <= c.mean[1]).toBe(true)
      for (const r of rs) {
        expect(Math.sign(r)).toBe(Math.sign(m))
        expect(r).not.toBe(m)
        expect(Math.abs(r - m)).toBeLessThanOrEqual(1.5 + 1e-9)
      }
      expect(new Set(rs).size).toBe(3)
      const terms = rs.map((r) => (r < 0 ? `(${fixed(r, 1)})` : fixed(r, 1))).join(' + ')
      expect(b.question.solution).toContain(`\\dfrac{${terms}}{3} = \\dfrac{${show(clean(rs[0]! + rs[1]! + rs[2]!))}}{3} = ${show(m)}$`)
      expect(b.question.solution).toContain(m > 0 ? 'water moved **in**' : 'water moved **out**')
      expect(method(b)).toEqual(['adds the three values and divides by 3'])
      expect(last(b)).toBe(`${m > 0 ? '+' : '−'}${show(Math.abs(m))}%`)
      expect(tolerance(b)).toBe(half(1, m))
      expect(mark(b.question, String(-m)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(6)
    spread('osmosis-mean-change', 'q24', ['r1', 'r2', 'r3'])
  })

  it('q25: the crossing read from the straight line between two results', () => {
    const built = build('osmosis-crossing-point', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const [[, p1, c1], [, p2, c2]] = [...p.matchAll(/([+−]\d+(?:\.\d)?)% in (\d\.\d+) mol\/dm³ sucrose/g)].map((m) => [m[0], num(m[1]!), Number(m[2])]) as [string, number, number][]
      expect(p1! > 0 && p2! < 0).toBe(true)
      const x = clean(c1! + ((c2! - c1!) * p1!) / (p1! - p2!))
      expect(answer(b)).toBe(x)
      expect(x > c1! && x < c2!).toBe(true)
      expect(x >= 0.2 && x <= 0.45).toBe(true)
      // Never the midpoint: halving the gap is not the method.
      expect(p1).not.toBe(-p2!)
      const s = TRANSPORT.SERIES.find((y) => y.name === b.values.context)!
      expect(p).toContain(`from 0 to ${fixed(s.top, 1)} mol/dm³ in steps of ${show(s.step)} mol/dm³`)
      const slope = (p1! - p2!) / (c2! - c1!)
      expect(slope >= 30 && slope <= 70).toBe(true)
      const dc = clean(c2! - c1!)
      const drop = clean(p1! - p2!)
      const per = clean(dc / drop)
      const shift = clean(p1! * per)
      expect(b.question.solution).toContain(`a drop of **${show(drop)} percentage points** across **${show(dc)} mol/dm³**`)
      expect(b.question.solution).toContain(`$${show(dc)} \\div ${show(drop)} = ${show(per)}$ mol/dm³`)
      expect(b.question.solution).toContain(`$${show(p1!)} \\times ${show(per)} = ${show(shift)}$ mol/dm³`)
      expect(b.question.solution).toContain(`$${show(c1!)} + ${show(shift)} = ${show(x)}$ mol/dm³`)
      expect(method(b)).toEqual([
        `a fall of ${show(drop)} percentage points across ${show(dc)} mol/dm³, so ${show(per)} mol/dm³ per point`,
        `${show(p1!)} points from +${show(p1!)}% to zero is ${show(p1!)} × ${show(per)} = ${show(shift)} mol/dm³ beyond ${show(c1!)}`,
      ])
      expect(last(b)).toBe(`${show(x)} mol/dm³`)
      expect(tolerance(b)).toBe(half(2, x))
      // The midpoint is marked wrong.
      expect(mark(b.question, String(clean((c1! + c2!) / 2))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(3)
    spread('osmosis-crossing-point', 'q25', ['p1', 'p2'])
  })
})

describe('exchange surfaces', () => {
  it('q2: six square faces of a cube of real size', () => {
    const built = build('cube-surface-area', 'q2')
    for (const b of built) {
      const p = b.question.prompt
      const [, s, u] = /sides of (\d+) (mm|µm)/.exec(p)!
      const side = Number(s)
      expect(answer(b)).toBe(6 * side * side)
      expect(p).toContain(`${u}²`)
      const c = TRANSPORT.CUBES.find((x) => x.name === b.values.context)!
      expect(c.unit).toBe(u)
      expect(c.sides).toContain(side)
      expect(side).not.toBe(6)
      if (c.name === 'animal cell') expect(side >= 10 && side <= 30).toBe(true)
      if (c.name === 'plant cell') expect(side >= 10 && side <= 100).toBe(true)
      expect(b.question.solution).toBe(`Six faces, each $${side} \\times ${side} = ${side * side}$ ${u}², so $6 \\times ${side * side} = ${6 * side * side}$ ${u}².`)
      expect(b.question.markScheme).toEqual([{ code: 'B1', marks: 1, description: `${6 * side * side} ${u}²` }])
      // Exact: 2166 mm² is the area, and 2170 is not.
      expect(tolerance(b)).toBe(0)
      if (figures(answer(b)) > 3) expect(mark(b.question, String(sigFigs(answer(b), 3))).correct).toBe(false)
      // The volume and one face are marked wrong.
      expect(mark(b.question, String(side ** 3)).correct).toBe(false)
      expect(mark(b.question, String(side * side)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    spread('cube-surface-area', 'q2', ['s'])
  })

  it('q5: a cube\'s ratio is 6 ÷ its side, worked from both totals', () => {
    const built = build('cube-surface-area-to-volume', 'q5')
    for (const b of built) {
      const p = b.question.prompt
      const [, s, u] = /sides of (\d+(?:\.\d+)?) (cm|mm|µm)/.exec(p)!
      const side = Number(s)
      const area = clean(6 * side * side)
      const volume = clean(side ** 3)
      expect(answer(b)).toBe(clean(area / volume))
      expect(answer(b)).toBe(clean(6 / side))
      expect(figures(answer(b))).toBeLessThanOrEqual(3)
      expect([1, 6]).not.toContain(side)
      expect(b.question.solution).toContain(`= ${g(area)}$ ${u}²`)
      expect(b.question.solution).toContain(`${side}^3 = ${g(volume)}$ ${u}³`)
      expect(b.question.solution).toContain(`= ${show(answer(b))} : 1$`)
      expect(method(b)).toEqual(['finds both the surface area and the volume'])
      expect(last(b)).toBe(`${show(answer(b))} : 1`)
      expect(tolerance(b)).toBe(0)
      // Volume over area is marked wrong.
      expect(mark(b.question, String(clean(side / 6))).correct).toBe(false)
      if (u === 'µm') expect(side >= 10 && side <= 100).toBe(true)
      if (/animal/.test(p)) expect(side).toBeLessThanOrEqual(30)
    }
    expect(contexts(built)).toBe(3)
    spread('cube-surface-area-to-volume', 'q5', ['s'])
    // The literal written case: a 3 cm cube is 54 cm² over 27 cm³.
    expect(TRANSPORT.RATIO_CUBES[0]!.sides).toContain(3)
  })

  it('q26: a cuboid\'s faces in pairs, its volume, and the ratio n : 1', () => {
    const built = build('cuboid-surface-area-to-volume', 'q26')
    for (const b of built) {
      const p = b.question.prompt
      const dims = (/(\d+(?:\.\d+)?) (?:cm|µm) by (\d+(?:\.\d+)?) (?:cm|µm) by (\d+(?:\.\d+)?) (?:cm|µm)/.exec(p) ?? /(\d+) mm long, (\d+(?:\.\d+)?) mm wide and (\d+(?:\.\d+)?) mm thick/.exec(p))!
        .slice(1)
        .map(Number) as [number, number, number]
      const [a, bb, c] = dims
      const area = clean(2 * (a * bb + a * c + bb * c))
      const volume = clean(a * bb * c)
      expect(answer(b)).toBe(clean(area / volume))
      expect(new Set(dims).size).toBeGreaterThan(1)
      expect(dims).not.toContain(1)
      expect(b.question.solution).toContain(`= ${g(area)}$`)
      expect(b.question.solution).toContain(`$${a} \\times ${bb} \\times ${c} = ${g(volume)}$`)
      expect(b.question.solution).toContain(`$\\dfrac{${g(area)}}{${g(volume)}} = ${show(answer(b))}$, written **${show(answer(b))} : 1**`)
      if (a === bb || bb === c) expect(b.question.solution).toMatch(/two faces of .* and four faces of /)
      else expect(b.question.solution).toContain('two faces each of')
      const unit = b.values.context === 'agar block' ? 'cm' : b.values.context === 'flatworm' ? 'mm' : 'µm'
      expect(method(b)).toEqual([`surface area ${show(area)} ${unit}² and volume ${show(volume)} ${unit}³`])
      expect(last(b)).toBe(`${show(answer(b))} : 1`)
      expect(tolerance(b)).toBe(0)
      expect(mark(b.question, String(clean(volume / area))).correct).toBe(false)
      if (b.values.context === 'flatworm') expect(c).toBeLessThanOrEqual(0.5)
      if (b.values.context === 'palisade cell') expect(c >= 40 && c <= 100).toBe(true)
    }
    expect(contexts(built)).toBe(3)
    spread('cuboid-surface-area-to-volume', 'q26', ['a', 'b', 'c'])
    // The written block, 2 by 2 by 4 cm, is 40 cm² over 16 cm³.
    expect(TRANSPORT.cuboids(TRANSPORT.BLOCKS[0]!).find((x) => x.d.join() === '2,2,4')!.ratio).toBe(2.5)
    // A square-ended block as a reader works it.
    const cell = build('cuboid-surface-area-to-volume', 'q26', 3000, 'written').find((b) => b.values.a === 20 && b.values.c === 80)!
    expect(cell.question.solution).toContain(
      'two faces of $20 \\times 20 = 400$ µm² and four faces of $20 \\times 80 = 1600$ µm², so the surface area is $(2 \\times 400) + (4 \\times 1600) = 800 + 6400 = 7200$ µm²',
    )
    expect(answer(cell)).toBe(0.225)
  })

  it('q12: area factor over thickness factor, not the area factor the student gave', () => {
    const built = build('fick-factor-claim', 'q12')
    const factors: Record<string, number> = { doubles: 2, triples: 3, halves: 0.5, 'falls to a quarter': 0.25, 'increases by half': 1.5 }
    const read = (s: string) => factors[s] ?? ({ 'two and a half': 2.5, four: 4, five: 5, six: 6 } as Record<string, number>)[/becomes ([\w ]+?) times/.exec(s)![1]!]!
    for (const b of built) {
      const p = b.question.prompt
      const [, areaDoes, thickDoes] = /(?:surface area of [^,.]*?) (doubles|triples|halves|falls to a quarter|increases by half|becomes [\w ]+? times as large) and (?:its membrane thickness|the thickness of the membrane between [a-z ]+? and the blood) (?:also )?(doubles|triples|halves|falls to a quarter|increases by half|becomes [\w ]+? times as great)/.exec(p)!
      const A = read(areaDoes!)
      const T = read(thickDoes!)
      expect(answer(b)).toBe(clean(A / T))
      expect(b.values.area).toBe(A)
      expect(b.values.thickness).toBe(T)
      // A real organ at most triples in area, and its membrane stays within half to three times as thick.
      if (b.values.context !== 'exchange surface') {
        expect(A).toBeLessThanOrEqual(3)
        expect(T >= 0.5 && T <= 3).toBe(true)
      }
      // The answer is never the thickness factor itself (4 ÷ 2 = 2).
      expect(answer(b)).not.toBe(T)
      expect(b.question.solution).toContain(`$\\dfrac{${show(A)}}{${show(T)}} = ${show(answer(b))}$`)
      expect(b.question.solution).toContain(`multiplies the rate by ${show(A)}`)
      expect(b.question.solution).toContain(`divides it by ${show(T)}`)
      expect(method(b)).toEqual(['divides the area factor by the thickness factor'])
      expect(last(b)).toBe(answer(b) === 1 ? '1, so the rate is unchanged' : show(answer(b)))
      if (A === T) expect(p).toContain(' also ')
      // The student's claim and multiplying the two factors are marked wrong.
      expect(mark(b.question, String(A)).correct).toBe(false)
      if (A * T !== A / T) expect(mark(b.question, String(clean(A * T))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    spread('fick-factor-claim', 'q12', ['area', 'thickness'])
    // The written design, both doubled, turns up.
    expect(TRANSPORT.CLAIMS.some((c) => c.A.f === 2 && c.T.f === 2 && c.k === 1)).toBe(true)
  })

  it('q13: a disease that shrinks the area and thickens the membrane, to two decimal places', () => {
    const built = build('fick-factor-disease', 'q13')
    const area = (p: string) => (/halves the surface area/.test(p) ? 0.5 : /to a quarter/.test(p) ? 0.25 : /to three quarters/.test(p) ? 0.75 : Number(/to (\d+)% of its healthy value/.exec(p)![1]) / 100)
    const thick: Record<string, number> = { 'one and a half': 1.5, twice: 2, 'two and a half': 2.5, three: 3, four: 4, five: 5 }
    for (const b of built) {
      const p = b.question.prompt
      const A = area(p)
      const T = thick[/(one and a half|twice|two and a half|three|four|five)(?: times)? as thick/.exec(p)![1]!]!
      const k = Number((A / T).toFixed(2))
      expect(answer(b)).toBe(k)
      expect(p).toMatch(/Give your answer to two decimal places\.$/)
      expect(A).toBeLessThan(1)
      expect(T).toBeGreaterThan(1)
      expect(b.question.solution).toContain(`$\\dfrac{${show(A)}}{${show(T)}} = `)
      expect(b.question.solution).toContain(fixed(k, 2))
      expect(method(b)).toEqual([`uses ${show(A)} for the surface area`, `divides by ${show(T)} for the thickness`])
      expect(last(b)).toBe(fixed(k, 2))
      expect(tolerance(b)).toBe(half(2, k))
      // The factor typed in full, unrounded, is marked right: 0.5 ÷ 3 = 0.1666… would not be.
      expect(mark(b.question, String(A / T)).correct, `${A} / ${T}`).toBe(true)
      expect(mark(b.question, (A / T).toFixed(4)).correct, `${A} / ${T}`).toBe(true)
      // Multiplying by the thickness is marked wrong.
      expect(mark(b.question, String(clean(A * T))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(3)
    spread('fick-factor-disease', 'q13', ['area', 'thickness'])
    // The written case, a half and three times as thick, is 0.1666…: rounded to 0.17 it is further
    // from the full value than the tolerance allows, so it is left out.
    expect(TRANSPORT.SCARRINGS.find((s) => s.A.f === 0.5 && s.T.f === 3)).toBeUndefined()
    for (const x of TRANSPORT.SCARRINGS) expect(Math.abs(x.exact - x.k)).toBeLessThanOrEqual(half(2, x.k))
  })

  it('q20: area × difference ÷ thickness, in arbitrary units', () => {
    const built = build('fick-rate', 'q20')
    for (const b of built) {
      const p = b.question.prompt
      const [, A, c, T] = /surface area of (\d+), a concentration difference of (\d+) and a membrane thickness of (\d+(?:\.\d+)?)/.exec(p)!.map(Number)
      const rate = clean((A! * c!) / T!)
      expect(answer(b)).toBe(rate)
      // An area of 100 or a difference of 10 would only move the point.
      expect(A).not.toBe(100)
      expect(c).not.toBe(10)
      expect(Number.isInteger(rate)).toBe(true)
      expect(figures(rate)).toBeLessThanOrEqual(3)
      expect(T).not.toBe(1)
      expect(b.question.solution).toContain(`\\dfrac{${A} \\times ${c}}{${show(T!)}} = \\dfrac{${A! * c!}}{${show(T!)}} = ${rate}$ arbitrary units`)
      expect(b.question.solution).toContain(T! < 1 ? 'a thin membrane gives a high rate' : 'a thicker membrane gives a lower rate')
      expect(method(b)).toEqual([`substitutes ${A} × ${c} ÷ ${show(T!)}`])
      expect(last(b)).toBe(String(rate))
      expect(tolerance(b)).toBe(0)
      // Multiplying by the thickness is marked wrong.
      expect(mark(b.question, String(clean(A! * c! * T!))).correct).toBe(false)
      expect(clearOf(rate, A!, c!, T!)).toBe(true)
    }
    expect(contexts(built)).toBe(4)
    spread('fick-rate', 'q20', ['area', 'diff', 't'])
  })

  it('q27: both rates, then the fall as a percentage of the healthy one', () => {
    const built = build('fick-percentage-decrease', 'q27')
    for (const b of built) {
      const p = b.question.prompt
      const [, A1, c, T1] = /surface area of (\d+), a concentration difference of (\d+) and a membrane thickness of (\d+(?:\.\d+)?)/.exec(p)!.map(Number)
      const [, A2, T2, c2] = /reduces the surface area to (\d+) and makes the membrane (\d+(?:\.\d+)?) units thick, while the concentration difference stays at (\d+)/.exec(p)!.map(Number)
      expect(c2).toBe(c)
      const R1 = clean((A1! * c!) / T1!)
      const R2 = clean((A2! * c!) / T2!)
      const pct = clean(((R1 - R2) / R1) * 100)
      expect(answer(b)).toBe(pct)
      expect(A2!).toBeLessThan(A1!)
      expect(T2!).toBeGreaterThan(T1!)
      expect(R1).not.toBe(100)
      expect(b.question.solution).toContain(`\\dfrac{${A1} \\times ${c}}{${show(T1!)}} = \\dfrac{${A1! * c!}}{${show(T1!)}} = ${R1}$`)
      expect(b.question.solution).toContain(`\\dfrac{${A2} \\times ${c}}{${show(T2!)}} = \\dfrac{${A2! * c!}}{${show(T2!)}} = ${R2}$`)
      expect(b.question.solution).toContain(`$${show(R1)} - ${show(R2)} = ${show(R1 - R2)}$, and $\\dfrac{${show(R1 - R2)}}{${show(R1)}} \\times 100 = ${show(pct)}$ %`)
      expect(method(b)).toEqual([`rates of ${show(R1)} and ${show(R2)} arbitrary units`, 'decrease divided by the original rate, × 100'])
      expect(last(b)).toBe(`${show(pct)} %`)
      expect(tolerance(b)).toBe(half(1, pct))
      // The decrease alone and the decrease over the diseased rate are marked wrong.
      expect(mark(b.question, String(clean(R1 - R2))).correct).toBe(false)
      expect(mark(b.question, String(clean(((R1 - R2) / R2) * 100))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(3)
    spread('fick-percentage-decrease', 'q27', ['A1', 'A2', 'c', 'T1', 'T2'])
    // The percentage is drawn evenly: no three percentages together fill a third of the builds,
    // as 75, 80 and 87.5% once filled half.
    const many = build('fick-percentage-decrease', 'q27', 2000, 'even')
    const counts = new Map<number, number>()
    for (const b of many) counts.set(answer(b), (counts.get(answer(b)) ?? 0) + 1)
    const top = [...counts.values()].sort((x, y) => y - x).slice(0, 3).reduce((x, y) => x + y, 0)
    expect(top / many.length).toBeLessThan(1 / 3)
  })
})

describe('the leaf, root hair cells, xylem and phloem', () => {
  it('q13: drawing length over real length, for cells of their real size', () => {
    const built = build('leaf-drawing-magnification', 'q13')
    const real: Record<string, [number, number]> = {
      'root hair cell': [0.2, 1],
      'guard cell': [0.02, 0.05],
      'palisade mesophyll cell': [0.04, 0.1],
      'phloem sieve tube element': [0.1, 0.5],
    }
    for (const b of built) {
      const p = b.question.prompt
      const [, D, R] = /is (\d+) mm long\. The real [a-z ]+ is (\d+\.\d+) mm long/.exec(p)!.map(Number)
      const M = clean(D! / R!)
      expect(answer(b)).toBe(M)
      expect(Number.isInteger(M) && M <= 1500 && M >= 20).toBe(true)
      const [lo, hi] = real[String(b.values.context)]!
      expect(R! >= lo && R! <= hi).toBe(true)
      expect(p).toContain(`A drawing of a ${b.values.context} is`)
      expect(b.question.solution).toContain(`= ${D} ÷ ${show(R!)} = ${M}. In an exam you would write this as ×${M}; type just ${M} here.`)
      expect(method(b)).toEqual([`${D} ÷ ${show(R!)}`])
      expect(last(b)).toBe(String(M))
      expect(tolerance(b)).toBe(0)
      // Not the drawing doubled or halved with the point moved, as 40 mm over 0.5 mm is.
      expect(shiftFree(M, D!, R!)).toBe(true)
      expect(mark(b.question, String(clean(R! / D!))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    spread('leaf-drawing-magnification', 'q13', ['D', 'R'])
  })

  it('q24: image ÷ magnification in mm, then × 1000 to µm', () => {
    const built = build('leaf-real-size', 'q24')
    for (const b of built) {
      const p = b.question.prompt
      const M = Number(/magnified ×(\d+)/.exec(p)![1])
      const image = Number(/ is (\d+(?:\.\d)?) mm (?:thick|long)/.exec(p)![1])
      const mm = clean(image / M)
      const um = clean(mm * 1000)
      expect(answer(b)).toBe(um)
      expect(Number.isInteger(um)).toBe(true)
      expect(TRANSPORT.PHOTO_MAGNIFICATIONS).toContain(M)
      expect([50, 100, 200, 500, 1000]).not.toContain(M)
      const t = TRANSPORT.TISSUES.find((x) => x.name === b.values.context)!
      expect(um >= t.real[0] && um <= t.real[1]).toBe(true)
      expect(p).toContain('There are 1000 µm in 1 mm.')
      expect(b.question.solution).toContain(`\\dfrac{${show(image)}}{${M}} = ${show(mm)}$ mm. Converting, $${show(mm)} \\times 1000 = ${um}$ µm.`)
      expect(method(b)).toEqual([`divides ${show(image)} mm by ${M} to get ${show(mm)} mm`])
      expect(last(b)).toBe(`${um} µm`)
      expect(tolerance(b)).toBe(0)
      // The answer left in mm is marked wrong.
      expect(mark(b.question, String(mm)).correct).toBe(false)
      expect(shiftFree(um, image, M)).toBe(true)
    }
    expect(contexts(built)).toBe(5)
    spread('leaf-real-size', 'q24', ['M', 'image'])
  })

  it('q25: the mean of three counts over a real field of view', () => {
    const built = build('leaf-stomatal-density', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const area = Number(/covers an area of (\d\.\d+) mm²/.exec(p)![1])
      const counts = /fields of view: (\d+), (\d+) and (\d+)\./.exec(p)!.slice(1).map(Number)
      const sum = counts[0]! + counts[1]! + counts[2]!
      const m = sum / 3
      expect(Number.isInteger(m)).toBe(true)
      const D = clean(m / area)
      expect(answer(b)).toBe(D)
      expect(TRANSPORT.FIELDS).toContain(area)
      expect(area >= 0.12 && area <= 0.25).toBe(true)
      expect(counts).not.toContain(m)
      expect(new Set(counts).size).toBe(3)
      const s = TRANSPORT.LEAF_SURFACES.find((x) => x.name === b.values.context)!
      expect(D >= s.density[0] && D <= s.density[1]).toBe(true)
      // Never 100 per mm², where the mean is the field's area with the point moved (15 in 0.15 mm²).
      expect(tenfold(D, 1)).toBe(false)
      expect(tenfold(m, area)).toBe(false)
      expect(p).toContain(`on the ${s.name} surface`)
      expect(b.question.solution).toContain(`\\dfrac{${counts.join(' + ')}}{3} = \\dfrac{${sum}}{3} = ${m}$ stomata in ${show(area)} mm²`)
      expect(b.question.solution).toContain(`$\\dfrac{${m}}{${show(area)}} = ${D}$ stomata per mm²`)
      expect(method(b)).toEqual([`finds the mean count: ${sum} ÷ 3 = ${m}`, `scales ${show(area)} mm² up to 1 mm²: divides by ${show(area)}`])
      expect(last(b)).toBe(`${D} stomata per mm²`)
      expect(tolerance(b)).toBe(0)
      // The mean alone, and the total over the area, are marked wrong.
      expect(mark(b.question, String(m)).correct).toBe(false)
      expect(mark(b.question, String(clean(sum / area))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(2)
    spread('leaf-stomatal-density', 'q25', ['area', 'c1'])
    // The upper surface carries fewer stomata than the lower.
    const [lower, upper] = TRANSPORT.LEAF_SURFACES
    expect(upper!.density[1]).toBeLessThanOrEqual(lower!.density[0])
  })
})

describe('transpiration and the potometer', () => {
  const condition = (b: Generated) => TRANSPORT.CONDITIONS.find((c) => c.name === b.values.context)!

  it('q6: distance over time at the speed the condition gives', () => {
    const built = build('potometer-rate', 'q6')
    for (const b of built) {
      const p = b.question.prompt
      const [, d, t] = /moves (\d+) mm in (\d+) minutes/.exec(p)!.map(Number)
      const rate = clean(d! / t!)
      expect(answer(b)).toBe(rate)
      const c = condition(b)
      expect(p).toContain(c.text)
      expect(rate >= c.rate[0] && rate <= c.rate[1]).toBe(true)
      expect([1, 10]).not.toContain(t)
      expect(b.question.solution).toBe(`Rate = distance ÷ time = ${d} ÷ ${t} = ${show(rate)} mm per minute.`)
      expect(method(b)).toEqual([`${d} ÷ ${t}`])
      expect(last(b)).toBe(`${show(rate)} mm per minute`)
      expect(tolerance(b)).toBe(half(2, rate))
      expect(mark(b.question, String(clean(t! / d!))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    // Humid air is slower than still air, and moving air faster.
    const r = Object.fromEntries(TRANSPORT.CONDITIONS.map((c) => [c.name, c.rate]))
    expect(r.humid![1]).toBeLessThan(r['still air']![1])
    expect(r.fan![1]).toBeGreaterThan(r['still air']![1])
    spread('potometer-rate', 'q6', ['d', 't'])
  })

  it('q24: the distance between two scale readings, over the time', () => {
    const built = build('potometer-scale-readings', 'q24')
    const words = ['', '', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty']
    for (const b of built) {
      const p = b.question.prompt
      const s = Number(/level with the (\d+) mm mark on the scale/.exec(p)![1])
      const [, w, e] = /\. (\w+) minutes later it is level with the (\d+) mm mark/.exec(p)!
      const t = words.indexOf(w!)
      const end = Number(e)
      expect(t).toBeGreaterThan(1)
      const rate = clean((end - s) / t)
      expect(answer(b)).toBe(rate)
      expect(s >= 2 && end <= 98).toBe(true)
      const c = condition(b)
      expect(rate >= c.rate[0] && rate <= c.rate[1]).toBe(true)
      expect(b.question.solution).toContain(`Distance moved $= ${end} - ${s} = ${end - s}$ mm. Rate $= \\dfrac{${end - s}}{${t}} = ${show(rate)}$ mm per minute.`)
      expect(method(b)).toEqual([`finds the distance moved, ${end} − ${s} = ${end - s} mm, and divides by ${t} minutes`])
      expect(last(b)).toBe(`${show(rate)} mm per minute`)
      expect(tolerance(b)).toBe(half(2, rate))
      // The end reading alone over the time is marked wrong.
      expect(mark(b.question, String(clean(end / t))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    spread('potometer-scale-readings', 'q24', ['start', 't'])
  })

  it('q17: the asked row of a table that rises or falls as the factor really does', () => {
    const built = build('potometer-table', 'q17')
    for (const b of built) {
      const p = b.question.prompt
      const T = Number(/moved in (\d+) minutes\./.exec(p)![1])
      const rows = [...p.matchAll(/^\| ([\w.]+) \| (\d+) \|$/gm)].map((m) => [m[1]!, Number(m[2])] as const)
      expect(rows).toHaveLength(4)
      const f = TRANSPORT.FACTORS.find((x) => x.name === b.values.context)!
      const ds = rows.map((r) => r[1])
      // Uptake rises with temperature and air movement, and falls with humidity and the lamp's distance.
      for (let k = 1; k < 4; k++) expect(f.rising ? ds[k]! - ds[k - 1]! : ds[k - 1]! - ds[k]!).toBeGreaterThanOrEqual(2)
      for (const d of ds) expect(d > T && d <= 95).toBe(true)
      // The slowest and fastest rows are each their own condition's speed (fan off is still air,
      // 85% humidity is humid air), and the factor changes the rate 1.5 to 3.5 times.
      const [lo, hi] = [Math.min(...ds), Math.max(...ds)]
      expect(lo >= f.slow[0] * T - 1e-9 && lo <= f.slow[1] * T + 1e-9, `${f.name} slow ${lo / T}`).toBe(true)
      expect(hi >= f.fast[0] * T - 1e-9 && hi <= f.fast[1] * T + 1e-9, `${f.name} fast ${hi / T}`).toBe(true)
      expect(hi >= 1.5 * lo && hi <= 3.5 * lo, `${lo} to ${hi}`).toBe(true)
      const i = Number(b.values.row)
      const level = rows[i]![0]
      expect(p).toContain(`Calculate the rate of water uptake ${f.at(Number.isNaN(Number(level)) ? level : Number(level))} in mm per minute.`)
      const rate = clean(ds[i]! / T)
      expect(answer(b)).toBe(rate)
      expect(b.question.solution).toBe(`Rate = distance ÷ time = ${ds[i]} ÷ ${T} = **${show(rate)} mm per minute**.`)
      expect(method(b)).toEqual([`${ds[i]} ÷ ${T}`])
      expect(last(b)).toBe(`${show(rate)} mm per minute`)
      expect(tolerance(b)).toBe(half(2, rate))
      // No other row is the answer, with or without the point moved.
      ds.forEach((d, k) => k === i || expect(tenfold(d, rate), `${d} and ${rate}`).toBe(false))
    }
    expect(contexts(built)).toBe(4)
    // Every row is asked, not only the last.
    expect(new Set(built.map((b) => b.values.row)).size).toBe(4)
    spread('potometer-table', 'q17', ['T', 'row', 'd'])
  })

  it('q25: both readings made rates first, then the rise over the first rate', () => {
    const built = build('potometer-percentage-increase', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const [[d1, t1], [d2, t2]] = [...p.matchAll(/moves (\d+) mm in (\d+) minutes/g)].map((m) => [Number(m[1]), Number(m[2])])
      expect(t1).not.toBe(t2)
      const r1 = clean(d1! / t1!)
      const r2 = clean(d2! / t2!)
      const pct = clean(((r2 - r1) / r1) * 100)
      expect(answer(b)).toBe(pct)
      expect(r2).toBeGreaterThan(r1)
      expect(r2).toBeLessThanOrEqual(12)
      const n = clean(d2! / d1!)
      const said = TRANSPORT.TIMES_WORDS[String(n)]!
      expect(p).toContain(`take up water ${said} as fast, because ${d2} is ${said} ${d1}.`)
      const c = TRANSPORT.COMPARISONS.find((x) => x.name === b.values.context)!
      expect(r1 >= c.baseRate[0] && r1 <= c.baseRate[1]).toBe(true)
      expect(b.question.solution).toContain(`$\\dfrac{${d1}}{${t1}} = ${show(r1)}$ mm per minute`)
      expect(b.question.solution).toContain(`$\\dfrac{${d2}}{${t2}} = ${show(r2)}$ mm per minute`)
      expect(b.question.solution).toContain(`$${show(r2)} - ${show(r1)} = ${show(clean(r2 - r1))}$ mm per minute`)
      expect(b.question.solution).toContain(`$\\dfrac{${show(clean(r2 - r1))}}{${show(r1)}} \\times 100 = ${show(pct)}\\%$`)
      expect(b.question.solution).toContain(t2! < t1! ? 'understated' : 'overstated')
      expect(method(b)).toEqual([
        `converts both readings to rates: ${show(r1)} and ${show(r2)} mm per minute`,
        `finds the increase and divides by the original rate (× 100): (${show(r2)} − ${show(r1)}) ÷ ${show(r1)} × 100`,
      ])
      expect(last(b)).toBe(`${show(pct)}%`)
      expect(tolerance(b)).toBe(half(1, pct))
      // The student's figure from the raw distances is marked wrong.
      expect(mark(b.question, String(clean((n - 1) * 100))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    spread('potometer-percentage-increase', 'q25', ['d1', 't1', 'd2', 't2'])
  })

  it('q9: π r² × distance to 1 decimal place, the same with π or 3.14', () => {
    const built = build('potometer-volume', 'q9')
    for (const b of built) {
      const p = b.question.prompt
      const r = Number(/radius (\d\.\d+) mm/.exec(p)![1])
      const [, d, t] = /moves (\d+) mm in (\d+) minutes/.exec(p)!.map(Number)
      const v = Number((Math.PI * r * r * d!).toFixed(1))
      expect(answer(b)).toBe(v)
      expect(Number((3.14 * r * r * d!).toFixed(1))).toBe(v)
      expect(TRANSPORT.RADII).toContain(r)
      const c = condition(b)
      expect(d! / t! >= c.rate[0] && d! / t! <= c.rate[1]).toBe(true)
      expect(p).toMatch(/to 1 decimal place; type the number only\.$/)
      expect(b.question.solution).toContain(`Volume = π × ${show(r)}² × ${d} = π × ${show(clean(r * r))} × ${d} = ${fixed(v, 1)} mm³`)
      expect(method(b)).toEqual([`π × ${show(r)}² × ${d}`, `${show(clean(r * r * d!))}π`])
      expect(last(b)).toBe(`${fixed(v, 1)} mm³`)
      expect(tolerance(b)).toBe(half(1, v))
      // The diameter taken for the radius, and the rate per minute, are marked wrong.
      expect(mark(b.question, String(Number((Math.PI * 4 * r * r * d!).toFixed(1)))).correct).toBe(false)
      expect(mark(b.question, String(Number((v / t!).toFixed(1)))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    spread('potometer-volume', 'q9', ['radius', 'd', 't'])
  })

  it('q13: loss over starting mass × 100 for a real plant, shoot or leaf', () => {
    const built = build('plant-mass-loss', 'q13')
    for (const b of built) {
      const p = b.question.prompt
      const w = TRANSPORT.WEIGHED.find((x) => x.name === b.values.context)!
      const [m0, m1] = [...p.matchAll(new RegExp(`(\\d+\\.\\d{${w.dp}}) g`, 'g'))].map((m) => Number(m[1]))
      const loss = clean(m0! - m1!)
      const pct = clean((loss / m0!) * 100)
      expect(answer(b)).toBe(pct)
      expect(m0! >= w.mass[0] && m0! <= w.mass[1]).toBe(true)
      expect(pct >= w.loss[0] && pct <= w.loss[1]).toBe(true)
      expect(b.question.solution).toContain(`Loss = ${fixed(m0!, w.dp)} − ${fixed(m1!, w.dp)} = ${fixed(loss, w.dp)} g. Percentage = ${fixed(loss, w.dp)} ÷ ${fixed(m0!, w.dp)} × 100 = ${show(pct)}%.`)
      expect(method(b)).toEqual([`${fixed(loss, w.dp)} ÷ ${fixed(m0!, w.dp)} × 100`])
      expect(last(b)).toBe(`${show(pct)}%`)
      expect(tolerance(b)).toBe(half(1, pct))
      // The loss itself, and the loss over the final mass, are marked wrong.
      expect(mark(b.question, String(loss)).correct).toBe(false)
      expect(mark(b.question, String(clean((loss / m1!) * 100))).correct).toBe(false)
      expect(shiftFree(pct, m0!, m1!, loss)).toBe(true)
    }
    expect(contexts(built)).toBe(3)
    spread('plant-mass-loss', 'q13', ['m0', 'm1'])
  })
})
