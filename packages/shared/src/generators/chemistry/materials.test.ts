import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mark } from '../../marking.ts'
import { Question } from '../../content/questions.ts'
import { fixed, roundTo, show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import { figures as sigCount, prose, tex } from '../physics/build.ts'
import { dpTolerance } from '../physics/format.ts'
import type { Generated } from '../types.ts'
import { shiftFree, threeFigures, toPlaces } from './build.ts'
import { MATERIALS_DATA as D, materialGenerators } from './materials.ts'

/**
 * Structural tests for the carat, ore, corrosion and life cycle generators. Each reads the
 * prompt's own figures back, works the answer again from them alone, checks every printed step
 * and the conversion, and checks each figure is one the thing really has: a hallmarked carat, an
 * ore grade a copper mine or spoil heap has, a coating mass its process gives, a recycling saving
 * in the range quoted for the material. Across builds they check the contexts rotate and that no
 * answer or input fills a context.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/chemistry')
const banks = new Map<string, Question[]>()
const bank = (topic: string) => {
  if (!banks.has(topic)) banks.set(topic, Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions))
  return banks.get(topic)!
}
function build(generatorId: string, slotId: string, count = 300): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bank(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `materials-${i}`))
}

const clean = (x: number) => Number(x.toPrecision(12))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const units = (b: Generated) => (b.question.type === 'numeric' ? b.question.units : 'not numeric')
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const tenfold = (a: number, b: number) => Math.abs(Math.log10(Math.abs(a / b)) - Math.round(Math.log10(Math.abs(a / b)))) < 1e-9
/** One doubled or halved with the point moved too: 60 kg from 0.3 kg/m² and 200 m². */
const moved = (a: number, b: number) => tenfold(a, b) || tenfold(a, 2 * b) || tenfold(2 * a, b)
/** A given, one with the point moved, or one doubled or halved. */
const shifted = (a: number, b: number) => tenfold(a, b) || clean(a) === clean(2 * b) || clean(2 * a) === clean(b)
const places = (x: number) => (show(x).includes('.') ? show(x).split('.')[1]!.length : 0)
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context))
/** The figures in a prompt, in order. */
const nums = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
const within = (x: number, [lo, hi]: readonly number[]) => x >= lo! - 1e-9 && x <= hi! + 1e-9

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
/** No answer or input over 40% of a context's builds, and at least `fewest` answers in each. */
function spread(id: string, slot: string, keys: string[], fewest = 10) {
  const many = build(id, slot, 1000)
  const a = worstShare(many, answer)
  expect(a.worst, `${id} answer`).toBeLessThanOrEqual(0.4)
  expect(a.fewest, `${id} answers per context`).toBeGreaterThanOrEqual(fewest)
  for (const k of keys) expect(worstShare(many, (b) => b.values[k]).worst, `${id} ${k}`).toBeLessThanOrEqual(0.4)
}

describe('every materials build', () => {
  it('stands in for the numeric written slots it names', () => {
    expect(materialGenerators.map((g) => `${g.topicId}/${g.replaces.join(',')}`).sort()).toEqual([
      'alloys-ceramics-polymers-and-composites/q15',
      'alloys-ceramics-polymers-and-composites/q5',
      'alloys-ceramics-polymers-and-composites/q9',
      'alternative-extraction-of-metals/q10',
      'alternative-extraction-of-metals/q17',
      'alternative-extraction-of-metals/q3',
      'corrosion-and-its-prevention/q17',
      'corrosion-and-its-prevention/q7',
      'life-cycle-assessment-and-recycling/q12',
      'life-cycle-assessment-and-recycling/q17',
      'life-cycle-assessment-and-recycling/q8',
    ])
  })

  it('prints no article before a figure, keeps the written units, ends on the answer and never fails to draw', () => {
    for (const g of materialGenerators) {
      for (const id of g.replaces) {
        const slot = bank(g.topicId).find((q) => q.id === id)!
        for (let i = 0; i < 2000; i++) {
          const b = generate(g, slot, `every-${i}`)
          expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          expect(units(b), b.seed).toBeUndefined()
          expect(b.question.markScheme.at(-1)!.description).toBe(show(answer(b)))
          expect(b.question.solution).toContain(String(answer(b)))
          expect(b.question.markScheme.reduce((t, l) => t + l.marks, 0)).toBe(slot.marks)
          expect(JSON.stringify(b.question)).not.toMatch(/\b1 times\b/)
        }
      }
    }
  })

  it('takes each answer, and its three-figure rounding, as a student would write it', () => {
    for (const g of materialGenerators) {
      for (const id of g.replaces) {
        for (const b of build(g.id, id, 200)) {
          const q = b.question
          if (q.type !== 'numeric') continue
          expect(mark(q, show(q.answer)).correct, `${g.id} ${b.seed}`).toBe(true)
          if (!/decimal place/.test(q.prompt)) expect(mark(q, String(Number(q.answer.toPrecision(3)))).correct, `${g.id} ${b.seed}`).toBe(true)
        }
      }
    }
  })
})

describe('carats', () => {
  it('q5: carats over 24, a carat in use, one decimal place asked only where the per cent does not end', () => {
    const built = build('carat-percentage', 'q5')
    for (const b of built) {
      const p = b.question.prompt
      const c = Number((/(\d+) carat/.exec(p) ?? /stamped (\d+)ct/.exec(p))![1])
      expect(D.CARATS).toContain(c)
      expect([12, 24]).not.toContain(c)
      const raw = (c / 24) * 100
      const ends = Math.abs(raw * 10 - Math.round(raw * 10)) < 1e-9
      expect(answer(b)).toBe(roundTo(raw, 1))
      expect(p.includes('to one decimal place')).toBe(!ends)
      expect(b.question.solution).toContain(`$\\dfrac{${c}}{24} \\times 100 ${ends ? '= $' : '\\approx'}`)
      expect(b.question.solution).toContain(`**${show(answer(b))}%**`)
      expect(method(b)).toEqual([`divides ${c} by 24`])
      expect(tolerance(b)).toBe(toPlaces(answer(b), places(answer(b))))
    }
    expect(contexts(built).size).toBe(3)
    spread('carat-percentage', 'q5', ['c'], 8)
  })

  for (const [id, slot, others] of [['carat-gold-mass', 'q9', false], ['carat-other-metals', 'q15', true]] as const) {
    it(`${slot}: the item's mass times ${others ? '(24 - carat)' : 'carat'} over 24, for a UK hallmark`, () => {
      const built = build(id, slot)
      for (const b of built) {
        const p = b.question.prompt
        const item = D.ITEMS.find((x) => x.name === b.values.context)!
        expect(p).toContain(item.name)
        const mText = /mass of (\d+\.\d) g/.exec(p)![1]!
        const m = Number(mText)
        const c = Number(/(\d+) carat/.exec(p)![1])
        expect(D.HALLMARKS).toContain(c)
        expect(within(m, item.mass)).toBe(true)
        const gold = clean((m * c) / 24)
        const rest = clean((m * (24 - c)) / 24)
        expect(answer(b)).toBe(others ? rest : gold)
        expect(clean(gold + rest)).toBe(m)
        expect(places(answer(b))).toBeLessThanOrEqual(2)
        expect(sigCount(answer(b))).toBeLessThanOrEqual(3)
        for (const g of [m, c]) expect(shifted(answer(b), g)).toBe(false)
        expect(gold).not.toBe(rest)
        const pct = (c / 24) * 100
        const ends = Math.abs(pct * 10 - Math.round(pct * 10)) < 1e-9
        const goldLine = ends ? `${c}/24 = ${show(pct)} per cent gold` : `${c}/24 of the mass is gold`
        expect(method(b)[0]).toBe(goldLine)
        if (others) expect(method(b)[1]).toBe(ends ? `${show(100 - pct)} per cent is other metals` : `${24 - c}/24 of the mass is other metals`)
        else expect(method(b)).toHaveLength(1)
        expect(b.question.solution).toContain(`\\times ${mText} = $ **${show(answer(b))} g**`)
        expect(tolerance(b)).toBe(threeFigures(dpTolerance(answer(b)), answer(b)))
      }
      expect(contexts(built).size).toBe(4)
      spread(id, slot, ['m', 'c'])
    })
  }
})

describe('copper from ores and ash', () => {
  it('q3: one tonne of an ore at a realistic grade, the per cent times ten', () => {
    const built = build('copper-per-tonne-of-ore', 'q3')
    for (const b of built) {
      const p = b.question.prompt
      const ore = D.ORE_GRADES.find((x) => x.name === b.values.context)!
      expect(p).toMatch(new RegExp(ore.noun, 'i'))
      expect(p).toContain('one tonne (1000 kg)')
      const pc = Number(/(\d+(?:\.\d+)?)% copper/.exec(p)![1])
      expect(within(pc, ore.grade)).toBe(true)
      expect(pc).toBeLessThanOrEqual(2.5)
      expect([1, 0.1]).not.toContain(pc)
      expect(answer(b)).toBe(clean((pc / 100) * 1000))
      expect(b.question.solution).toBe(`$\\dfrac{${show(pc)}}{100} \\times 1000 = $ **${show(answer(b))} kg**.`)
      expect(b.question.markScheme.map((l) => l.code)).toEqual(['B1'])
      expect(tolerance(b)).toBe(dpTolerance(answer(b)))
    }
    expect(contexts(built).size).toBe(3)
    spread('copper-per-tonne-of-ore', 'q3', ['p'])
  })

  it('q10: tonnes to kg, then the per cent of it, for a load the vehicle or heap really holds', () => {
    const built = build('copper-in-a-load-of-ore', 'q10')
    for (const b of built) {
      const p = b.question.prompt
      const load = D.LOADS.find((x) => x.name === b.values.context)!
      const t = Number(/(\d[\d ]*) tonnes/.exec(p)![1]!.replace(/ /g, ''))
      const pc = Number(/(\d+(?:\.\d+)?)% copper/.exec(p)![1])
      expect(within(t, load.tonnes)).toBe(true)
      expect(within(pc, load.grade)).toBe(true)
      expect(p).toContain('(1 tonne = 1000 kg)')
      const kg = t * 1000
      expect(answer(b)).toBe(clean((pc / 100) * kg))
      expect(answer(b)).toBeLessThan(10000)
      // Never the printed conversion's 1000, a power of ten, or 1000 doubled or halved.
      expect(tenfold(answer(b), 1) || shifted(answer(b), 1000)).toBe(false)
      expect(sigCount(answer(b))).toBeLessThanOrEqual(3)
      for (const g of [t, pc]) expect(moved(answer(b), g)).toBe(false)
      for (const g of [t, pc]) expect(tenfold(g, 1)).toBe(false)
      expect(method(b)).toEqual([`converts to ${prose(kg)} kg`])
      expect(b.question.solution).toBe(`$${tex(t)}\\text{ tonnes} = ${tex(kg)}\\text{ kg}$; $\\dfrac{${show(pc)}}{100} \\times ${tex(kg)} = $ **${show(answer(b))} kg**.`)
      expect(tolerance(b)).toBe(threeFigures(dpTolerance(answer(b)), answer(b)))
    }
    expect(contexts(built).size).toBe(3)
    spread('copper-in-a-load-of-ore', 'q10', ['t', 'p'])
  })

  it('q17: the per cent of the ash, copper a few per cent and nickel 10 to 20', () => {
    const built = build('metal-in-phytomining-ash', 'q17')
    for (const b of built) {
      const p = b.question.prompt
      const ash = D.ASHES.find((x) => x.name === b.values.context)!
      const m = new RegExp(`(\\d+(?:\\.\\d+)?)% ${ash.metal}`).exec(p)!
      const pc = Number(m[1])
      const kg = Number(/in (\d+) kg of/.exec(p)![1])
      expect(within(pc, ash.grade)).toBe(true)
      expect(pc).not.toBe(10)
      expect(kg >= 40 && kg <= 900).toBe(true)
      expect(tenfold(kg, 1)).toBe(false)
      expect(answer(b)).toBe(clean((pc * kg) / 100))
      for (const g of [pc, kg]) expect(moved(answer(b), g)).toBe(false)
      expect(method(b)).toEqual([`takes ${show(pc)}% of ${kg}`])
      expect(b.question.solution).toBe(`$\\dfrac{${show(pc)}}{100} \\times ${kg} = $ **${show(answer(b))} kg** — ${ash.richer}.`)
      expect(p).toContain(`mass of ${ash.metal}`)
      expect(tolerance(b)).toBe(threeFigures(dpTolerance(answer(b)), answer(b)))
    }
    expect(contexts(built).size).toBe(2)
    spread('metal-in-phytomining-ash', 'q17', ['p', 'm'])
  })
})

describe('corrosion', () => {
  it('q7: the mass after less the mass before, both to 0.01 g, a few per cent gained', () => {
    const built = build('rusting-mass-gain', 'q7')
    for (const b of built) {
      const p = b.question.prompt
      const c = D.RUSTING.find((x) => x.name === b.values.context)!
      const [bt, at] = [...p.matchAll(/(\d+\.\d\d) g/g)].map((m) => m[1]!)
      const [before, after] = [Number(bt), Number(at)]
      expect(within(before, c.before)).toBe(true)
      const gain = clean(after - before)
      expect(answer(b)).toBe(gain)
      expect(within(gain, c.gain)).toBe(true)
      expect(gain).toBeLessThanOrEqual(before * c.most + 1e-9)
      expect(bt!.endsWith(fixed(gain, 2).slice(-2))).toBe(false)
      expect(shifted(gain, before)).toBe(false)
      expect(b.question.solution).toContain(`$${at} - ${bt} = $ **${fixed(gain, 2)} g**`)
      expect(tolerance(b)).toBe(toPlaces(gain, 2))
      expect(p).toMatch(c.name === 'steel wool' ? /steel wool/ : /nail/)
    }
    expect(contexts(built).size).toBe(3)
    spread('rusting-mass-gain', 'q7', ['before', 'gain'])
  })

  it('q17: zinc per m² times the area, a coating mass the process gives', () => {
    const built = build('zinc-on-galvanised-steel', 'q17')
    for (const b of built) {
      const p = b.question.prompt
      const c = D.COATINGS.find((x) => x.name === b.values.context)!
      const k = Number(/(\d+(?:\.\d+)?) kg of zinc per m²/.exec(p)![1])
      const a = Number(/(\d+) m² of/.exec(p)![1])
      expect(within(k, c.rate)).toBe(true)
      expect(within(a, c.area)).toBe(true)
      expect(answer(b)).toBe(clean(k * a))
      expect(clean(k + a)).not.toBe(answer(b))
      for (const g of [k, a]) expect(moved(answer(b), g)).toBe(false)
      expect(method(b)).toEqual([`multiplies ${show(k)} by ${a}`])
      expect(b.question.solution).toContain(`$${show(k)} \\times ${a} = $ **${show(answer(b))} kg** of zinc`)
      expect(tolerance(b)).toBe(threeFigures(dpTolerance(answer(b)), answer(b)))
    }
    expect(contexts(built).size).toBe(3)
    spread('zinc-on-galvanised-steel', 'q17', ['k', 'a'])
  })
})

describe('life cycle assessment', () => {
  it('q8: the heavier bag\'s energy over the plastic bag\'s, a whole number of uses in the range LCAs find', () => {
    const built = build('lca-bag-uses-to-match', 'q8')
    for (const b of built) {
      const p = b.question.prompt
      const bag = D.BAGS.find((x) => x.name === b.values.context)!
      expect(p).toContain(bag.full)
      const [h, l] = nums(p)
      expect(D.THIN).toContain(l)
      // The answer is never read off the heavy bag's figure: 3.3 ÷ 1.1 = 3.
      expect(Math.floor(h!)).not.toBe(answer(b))
      expect(D.THIN).not.toContain(1.1)
      expect(answer(b)).toBe(clean(h! / l!))
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(within(answer(b), bag.times)).toBe(true)
      for (const g of [h!, l!]) expect(shifted(answer(b), g)).toBe(false)
      expect(method(b)).toEqual([`divides ${fixed(h!, 1)} by ${fixed(l!, 1)}`])
      expect(b.question.solution).toContain(`$\\dfrac{${fixed(h!, 1)}}{${fixed(l!, 1)}} = $ **${answer(b)} times**`)
      expect(tolerance(b)).toBe(0)
    }
    expect(contexts(built).size).toBe(3)
    // Paper and the bag-for-life need 2 to 9 uses, so seven answers is all there are.
    spread('lca-bag-uses-to-match', 'q8', ['light', 'heavy'], 7)
  })

  it('q12: the energy saved over the energy from raw materials, in the range quoted for the material', () => {
    const built = build('recycling-energy-saved', 'q12')
    for (const b of built) {
      const p = b.question.prompt
      const m = D.MATERIALS.find((x) => x.name === b.values.context)!
      expect(p.toLowerCase()).toContain(m.name)
      const e = Number(/compared with (\d+) units|uses (\d+) units of energy per kg;/.exec(p)!.slice(1).find(Boolean))
      const r = Number(/Recycling [a-z]+ uses (\d+) units|uses (\d+) units\. What/.exec(p)!.slice(1).find(Boolean))
      expect(e).toBeGreaterThan(r)
      expect(tenfold(e, 1)).toBe(false)
      const saving = clean(((e - r) / e) * 100)
      expect(answer(b)).toBe(saving)
      expect(within(saving, m.saving)).toBe(true)
      expect(places(saving)).toBeLessThanOrEqual(1)
      expect(saving).not.toBe(50)
      for (const g of [e, r, e - r]) expect(tenfold(saving, g)).toBe(false)
      expect(method(b)).toEqual([`finds the saving of ${e - r} units`])
      expect(b.question.solution).toBe(`$\\dfrac{${e} - ${r}}{${e}} \\times 100 = $ **${show(saving)}%**.`)
      expect(tolerance(b)).toBe(threeFigures(dpTolerance(saving), saving))
    }
    expect(contexts(built).size).toBe(5)
    spread('recycling-energy-saved', 'q12', ['e', 'r'])
  })

  it('q17: the energy over the uses, to two decimal places, compared truly with the other bag', () => {
    const built = build('lca-energy-per-use', 'q17')
    for (const b of built) {
      const p = b.question.prompt
      const x = D.REUSES.find((y) => y.name === b.values.context)!
      expect(p).toContain(x.item)
      expect(p).toContain(x.other)
      const [e, o] = [...p.matchAll(/(\d+(?:\.\d+)?) units/g)].map((m) => Number(m[1]))
      const n = Number(/used (\d+) times/.exec(p)![1])
      expect(within(e!, x.energy)).toBe(true)
      expect(within(o!, x.single)).toBe(true)
      expect(within(n, x.uses)).toBe(true)
      expect(answer(b)).toBe(roundTo(e! / n, 2))
      expect(answer(b)).toBeGreaterThanOrEqual(0.1)
      expect(Math.round(answer(b) * 100) % 10).not.toBe(0)
      expect(Math.abs(answer(b) - o!)).toBeGreaterThanOrEqual(0.05 - 1e-9)
      for (const g of [e!, n, o!]) expect(shifted(answer(b), g)).toBe(false)
      // Nor a given doubled or halved with the point moved: 0.6 ÷ 5 = 0.12.
      expect(shiftFree(answer(b), e!, n, o!)).toBe(true)
      const word = answer(b) < o! ? (answer(b) * 2 < o! ? 'well below' : 'below') : 'still above'
      expect(b.question.solution).toContain(`**${fixed(answer(b), 2)} units per use** — ${word} the ${x.other}'s ${show(o!)} units`)
      expect(b.question.solution).toContain(`$\\dfrac{${show(e!)}}{${n}}`)
      expect(method(b)).toEqual([`divides ${show(e!)} by ${n}`])
      expect(tolerance(b)).toBe(toPlaces(answer(b), 2))
    }
    expect(contexts(built).size).toBe(3)
    spread('lca-energy-per-use', 'q17', ['e', 'n', 'other'])
  })
})
