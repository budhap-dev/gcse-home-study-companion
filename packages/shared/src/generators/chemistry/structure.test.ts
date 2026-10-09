import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ELEMENTS } from '../../elements.ts'
import { mark } from '../../marking.ts'
import { Question } from '../../content/questions.ts'
import { roundTo, show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import { prose, tex } from '../physics/build.ts'
import type { Generated } from '../types.ts'
import { AR, shiftFree, toPlaces } from './build.ts'
import { STRUCTURE, structureGenerators } from './structure.ts'

/**
 * Structural tests for the atomic structure, bonding, nanoparticle and chromatography
 * generators. Each reads the prompt's own figures back, works the answer again from them alone,
 * and checks every printed step against them and against the real element: atomic numbers from
 * the periodic table, mass numbers of nuclides that exist, abundances that are the element's own,
 * charges GCSE gives the ion. Across builds they check the contexts rotate, no answer or input
 * fills a context, and no prompt says "a 8".
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
  return Array.from({ length: count }, (_, i) => generate(g, slot, `structure-${i}`))
}

const Z = Object.fromEntries(ELEMENTS.map((e) => [e.symbol, e.z]))
const SYMBOL = Object.fromEntries(ELEMENTS.map((e) => [e.name, e.symbol]))
const clean = (x: number) => Number(x.toPrecision(12))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const units = (b: Generated) => (b.question.type === 'numeric' ? b.question.units : 'not numeric')
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const values = (b: Generated) => b.values as Record<string, any>
const tenfold = (a: number, b: number) => Math.abs(Math.log10(Math.abs(a / b)) - Math.round(Math.log10(Math.abs(a / b)))) < 1e-9
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context))

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

describe('every structure build', () => {
  it('stands in for the numeric written slots it names, and no others', () => {
    expect(structureGenerators.map((g) => `${g.topicId}/${g.replaces.join(',')}`).sort()).toEqual([
      'atoms-ions-and-isotopes/q2',
      'atoms-ions-and-isotopes/q6',
      'atoms-ions-and-isotopes/q7',
      'carbon-structures-and-nanoparticles/q16',
      'ionic-bonding/q12',
      'pure-substances-and-formulations/q5',
    ])
  })

  it('prints no article before a figure, keeps the written units, ends on the answer and never fails to draw', () => {
    for (const g of structureGenerators) {
      for (const id of g.replaces) {
        const slot = bank(g.topicId).find((q) => q.id === id)!
        for (let i = 0; i < 2000; i++) {
          const b = generate(g, slot, `every-${i}`)
          expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          expect(units(b), b.seed).toBe(slot.type === 'numeric' ? slot.units : undefined)
          expect(b.question.markScheme.at(-1)!.description).toBe(show(answer(b)))
          expect(b.question.solution).toContain(String(answer(b)))
          expect(b.question.markScheme.reduce((t, l) => t + l.marks, 0)).toBe(slot.marks)
        }
      }
    }
  })
})

describe('atoms, isotopes and ions', () => {
  it('q2: the mass number less the atomic number, for a nuclide that exists', () => {
    const built = build('neutrons-in-an-atom', 'q2')
    for (const b of built) {
      const p = b.question.prompt
      let symbol: string, a: number, z: number
      if (b.values.context === 'symbol') {
        const m = /\^\{(\d+)\}_\{(\d+)\}\\mathrm\{(\w+)\}/.exec(p)!
        ;[a, z, symbol] = [Number(m[1]), Number(m[2]), m[3]!]
      } else if (b.values.context === 'named') {
        const m = /([a-z]+)-(\d+)/.exec(p)!
        ;[symbol, a] = [SYMBOL[m[1]!]!, Number(m[2])]
        z = Number(/atomic number (\d+)/.exec(p)![1])
        expect(b.question.solution).toContain(`The ${a} in ${m[1]}-${a} is the mass number`)
      } else {
        a = Number(/mass number (\d+)/.exec(p)![1])
        z = Number(/atomic number (?:is )?(\d+)/.exec(p)![1])
        symbol = STRUCTURE.NUCLIDES.find(([s, m]) => m === a && Z[s] === z)![0]
      }
      expect(Z[symbol]).toBe(z)
      expect(STRUCTURE.NUCLIDES.some(([s, m]) => s === symbol && m === a), `${symbol}-${a}`).toBe(true)
      expect(answer(b)).toBe(a - z)
      expect(answer(b)).not.toBe(z)
      expect(b.question.solution).toContain(`$${a} - ${z} = ${a - z}$ neutrons`)
      expect(method(b)).toEqual(['subtracts atomic number from mass number'])
      expect(tolerance(b)).toBe(0)
    }
    expect(contexts(built).size).toBe(3)
    spread('neutrons-in-an-atom', 'q2', ['symbol', 'z', 'a'])
  })

  it('q6: the abundances are the element\'s own, total 100 (or 1000 atoms), and the mean is worked from them', () => {
    const built = build('relative-atomic-mass-from-abundance', 'q6', 600)
    for (const b of built) {
      const p = b.question.prompt
      const iso = STRUCTURE.ISOTOPES.find((x) => x.symbol === values(b).symbol)!
      const pairs =
        b.values.context === 'per cent'
          ? [...p.matchAll(/(\d+(?:\.\d+)?)% [a-z]+-(\d+)/g)].map((m) => [m[1]!, Number(m[2])] as const)
          : b.values.context === 'atoms'
            ? [...p.matchAll(/(\d+) (?:are|atoms of) [a-z]+-(\d+)/g)].map((m) => [m[1]!, Number(m[2])] as const)
            : [...p.matchAll(/[a-z]+-(\d+) \((\d+(?:\.\d+)?)%\)/g)].map((m) => [m[2]!, Number(m[1])] as const)
      const T = b.values.context === 'atoms' ? Number(/every (\d+) atoms/.exec(p)![1]) : 100
      expect(pairs.map(([, m]) => m)).toEqual(iso.masses)
      const amounts = pairs.map(([a]) => Number(a))
      expect(clean(amounts.reduce((t, a) => t + a, 0))).toBe(T)
      // The element's own rounded abundances, scaled to the atoms counted.
      const own = (values(b).step === 1 ? iso.whole : iso.tenths)!.map((a) => clean((a * T) / 100))
      expect(amounts).toEqual(own)
      // A tenth of a per cent keeps its figure: 95.0%, not 95%.
      if (b.values.context !== 'atoms' && values(b).step === 0.1) for (const [a] of pairs) expect(a).toMatch(/\.\d$/)
      const total = clean(amounts.reduce((t, a, i) => t + a * iso.masses[i]!, 0))
      const raw = clean(total / T)
      expect(answer(b)).toBe(roundTo(raw, 1))
      expect(Math.abs(answer(b) - AR[iso.symbol]!)).toBeGreaterThan(0.05)
      for (const [a, m] of pairs) expect(b.question.solution).toContain(`(${a} \\times ${m})`)
      expect(b.question.solution).toContain(`= ${tex(total)}$, and $${tex(total)} \\div ${T} = ${show(raw)}$, so **${show(answer(b))}**`)
      expect(method(b)).toEqual(['multiplies each mass by its abundance', `divides the total by ${T}`])
      expect(tolerance(b)).toBe(0.05)
      expect(p).toContain('to one decimal place')
      // The mean lies between the lightest and heaviest isotopes, nearer the more abundant of two.
      expect(answer(b) > iso.masses[0]! && answer(b) < iso.masses.at(-1)!).toBe(true)
      if (iso.masses.length === 2) {
        const major = iso.masses[amounts[0]! > amounts[1]! ? 0 : 1]!
        const minor = iso.masses.find((m) => m !== major)!
        expect(Math.abs(raw - major)).toBeLessThan(Math.abs(raw - minor))
        expect(b.question.solution).toContain(`nearer ${major}`)
      }
    }
    expect(contexts(built).size).toBe(3)
    spread('relative-atomic-mass-from-abundance', 'q6', ['symbol'], 15)
    // Both roundings turn up in every context that can print them (atoms print whole counts of 100 or 1000).
    for (const c of contexts(built)) expect(new Set(built.filter((b) => b.values.context === c).map((b) => values(b).step)).size, String(c)).toBe(2)
  })

  it('q6: every abundance set is real-looking: the masses ascend, the per cents total 100, and no answer sits on a half', () => {
    for (const iso of STRUCTURE.ISOTOPES) {
      expect([...iso.masses].sort((a, b) => a - b)).toEqual(iso.masses)
      for (const set of [iso.whole, iso.tenths]) if (set) expect(clean(set.reduce((t, a) => t + a, 0))).toBe(100)
    }
    expect(STRUCTURE.abundances().length).toBeGreaterThanOrEqual(30)
  })

  it('q7: the protons less the charge, for an ion with its real charge', () => {
    const built = build('electrons-in-an-ion', 'q7')
    for (const b of built) {
      const p = b.question.prompt
      const ion = /\b([A-Z][a-z]?)(\d)?([+-])(?=[ ,.?]|$)/.exec(p)!
      const symbol = ion[1]!
      const q = Number(ion[2] ?? 1) * (ion[3] === '+' ? 1 : -1)
      const z = Number((/atomic number (\d+)/.exec(p) ?? /atomic number of [a-z]+ is (\d+)/.exec(p))![1])
      expect(Z[symbol]).toBe(z)
      expect(STRUCTURE.IONS.some(([s, c]) => s === symbol && c === q), `${symbol} ${q}`).toBe(true)
      expect(Math.sign(q)).toBe(b.values.context === 'positive' ? 1 : -1)
      const e = z - q
      expect(answer(b)).toBe(e)
      expect(b.question.solution).toContain(q > 0 ? `$${z} - ${q} = ${e}$ electrons` : `$${z} - (-${-q}) = ${e}$ electrons`)
      expect(b.question.solution).toContain(q > 0 ? '**lost' : '**gained')
      expect(method(b)).toEqual([`accounts for the ${Math.abs(q)}${q > 0 ? '+' : '-'} charge`])
      // Up to calcium the arrangement is printed, and it is a full outer shell with the electrons counted.
      if (z <= 20) {
        const shells = /giving ([\d,]+) — a full outer shell/.exec(b.question.solution)![1]!.split(',').map(Number)
        expect(shells.reduce((t, s) => t + s, 0)).toBe(e)
        expect([2, 8]).toContain(shells.at(-1))
      } else expect(b.question.solution).not.toContain('outer shell')
      expect(tolerance(b)).toBe(0)
    }
    expect(contexts(built).size).toBe(2)
    // Negative ions all reach a noble gas: 10, 18, 36 or 54 electrons, and no more answers than that exist.
    spread('electrons-in-an-ion', 'q7', ['ion', 'z'], 4)
    // No charge pays a lazy rule ("add one", "take one away"): each is at most 40% of a context, and every charge turns up.
    const many = build('electrons-in-an-ion', 'q7', 1000)
    expect(worstShare(many, (b) => values(b).ion.replace(/^[A-Z][a-z]?/, '')).worst).toBeLessThanOrEqual(0.4)
    for (const c of ['positive', 'negative']) expect(new Set(many.filter((b) => b.values.context === c).map((b) => values(b).ion.replace(/^[A-Z][a-z]?/, ''))).size, c).toBe(3)
    expect(STRUCTURE.arrangement(18)).toBe('2,8,8')
    expect(STRUCTURE.arrangement(10)).toBe('2,8')
  })
})

describe('ionic formulae', () => {
  const SUP: Record<string, number> = { '': 1, '²': 2, '³': 3 }
  const WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

  it('q12: the charges balance, and the count follows from them', () => {
    const built = build('ionic-formula-ratio', 'q12', 600)
    for (const b of built) {
      const p = b.question.prompt
      const metal = /metal ([MXQ]) forms \1([²³]?)⁺ ions/.exec(p)!
      const a = SUP[metal[2]!]!
      const anion = /([a-z]+) ions, ([A-Z][a-z]?)([²³]?)⁻/.exec(p)!
      const bq = SUP[anion[3]!]!
      const real = STRUCTURE.ANIONS.find((x) => x.name === anion[1])!
      expect(real.symbol).toBe(anion[2])
      expect(real.charge).toBe(bq)
      expect(p).toContain(`In its ${anion[1]},`)
      const k = WORD.indexOf(/for every ([a-z]+) /.exec(p)![1]!)
      expect(k).toBeGreaterThanOrEqual(2)
      const anionsAsked = b.values.context === 'anions'
      expect(p.indexOf(`${anion[1]} ions`) < p.indexOf('for every')).toBe(anionsAsked)
      const expected = anionsAsked ? (k * a) / bq : (k * bq) / a
      expect(answer(b)).toBe(expected)
      expect(Number.isInteger(expected)).toBe(true)
      expect([a, bq, k]).not.toContain(answer(b))
      // The formula printed balances: metal ions × a = anions × b, in lowest terms.
      const f = new RegExp(`: ${metal[1]}([₂₃]?)${anion[2]}([₂₃]?)\\.$`).exec(b.question.solution)!
      const sub = (s: string) => (s ? s.charCodeAt(0) - 0x2080 : 1)
      expect(sub(f[1]!) * a).toBe(sub(f[2]!) * bq)
      const total = k * (anionsAsked ? a : bq)
      expect(b.question.solution).toContain(`carry ${total}`)
      expect(b.question.solution).toContain(`**${answer(b)}** are needed to give ${total}`)
      expect(b.question.markScheme.map((l) => l.code)).toEqual(['B1'])
    }
    expect(contexts(built).size).toBe(2)
    spread('ionic-formula-ratio', 'q12', ['a', 'b', 'k', 'anion'])
  })
})

describe('nanoparticles', () => {
  it('q16: 6 ÷ side for cubes of 1 to 100 nm, with the area and volume printed', () => {
    const built = build('nanoparticle-surface-area-to-volume', 'q16')
    for (const b of built) {
      const p = b.question.prompt
      const [s1, r1, s2] = [...p.matchAll(/(\d+(?:\.\d+)?) (?:nm|per nm)/g)].map((m) => Number(m[1]))
      for (const s of [s1!, s2!]) expect(s >= 1 && s <= 100).toBe(true)
      expect(r1).toBe(clean(6 / s1!))
      expect(answer(b)).toBe(clean(6 / s2!))
      expect(s2! < s1!).toBe(b.values.context === 'smaller')
      expect(tenfold(s1!, s2!)).toBe(false)
      expect(shiftFree(answer(b), s1!, s2!, r1!)).toBe(true)
      expect(answer(b)).not.toBe(1)
      const [area, volume] = [6 * s2! ** 2, s2! ** 3]
      expect(b.question.solution).toContain(`$6 \\times ${s2}^2 = ${tex(area)}\\text{ nm}^2$`)
      expect(b.question.solution).toContain(`$${s2}^3 = ${tex(volume)}\\text{ nm}^3$`)
      expect(b.question.solution).toContain(`$${tex(area)} \\div ${tex(volume)} = ${show(answer(b))}$ per nm.`)
      expect(b.question.solution).toContain(`$6 \\div ${s1} = ${show(r1!)}$ per nm`)
      expect(method(b)).toEqual([`Ratio = 6 ÷ side, or surface area ${prose(area)} nm² and volume ${prose(volume)} nm³`])
      expect(units(b)).toBe('per nm')
      // 6 ÷ a whole side ends exactly: no room, as written, so 1.18 is not 1.2.
      expect(tolerance(b)).toBe(0)
      expect(p).toContain('Give your answer in the same units.')
    }
    expect(contexts(built).size).toBe(2)
    spread('nanoparticle-surface-area-to-volume', 'q16', ['s1', 's2'])
  })
})

describe('chromatography', () => {
  it('q5: the spot over the front, both to 0.1 cm, the spot short of the front', () => {
    const built = build('chromatography-rf-value', 'q5')
    for (const b of built) {
      const p = b.question.prompt
      const m =
        /moves (\d+\.\d) cm while the solvent front moves (\d+\.\d) cm/.exec(p) ??
        /travels (\d+\.\d) cm from the start line and the solvent travels (\d+\.\d) cm/.exec(p)
      const n = /solvent front is (\d+\.\d) cm from the start line and one spot is (\d+\.\d) cm/.exec(p)
      const [d, f] = m ? [m[1]!, m[2]!] : [n![2]!, n![1]!]
      const paper = STRUCTURE.PAPERS.find((x) => x.name === b.values.context)!
      expect(p).toContain(paper.intro)
      expect(Number(f) >= paper.front[0] && Number(f) <= paper.front[1]).toBe(true)
      expect(Number(d)).toBeLessThanOrEqual(clean(Number(f) - 0.5))
      expect(Number(d)).toBeGreaterThanOrEqual(0.5)
      expect(answer(b)).toBe(clean(Number(d) / Number(f)))
      expect(answer(b) > 0 && answer(b) < 1).toBe(true)
      // 10.0 moves the point; 5.5 and 11.0 let the Rf be read off the spot (3.3 ÷ 11.0 = 0.3).
      expect([5.5, 10, 11]).not.toContain(Number(f))
      expect(shiftFree(answer(b), Number(d), Number(f))).toBe(true)
      expect(b.question.solution).toBe(`$R_f = \\dfrac{${d}}{${f}} = ${show(answer(b))}$. No unit, because the centimetres cancel.`)
      expect(method(b)).toEqual(['divides spot distance by solvent distance'])
      // Half a unit in the second place, so 0.79 is not 0.8.
      expect(tolerance(b)).toBe(toPlaces(answer(b), 2))
      if (answer(b) === 0.8) expect(mark(b.question, '0.79').correct).toBe(false)
    }
    expect(contexts(built).size).toBe(3)
    spread('chromatography-rf-value', 'q5', ['d', 'f'])
    // Two-place Rf values, as the written 0.75, are at least half of every context.
    const many = build('chromatography-rf-value', 'q5', 1000)
    for (const c of contexts(many)) {
      const mine = many.filter((b) => b.values.context === c)
      expect(mine.filter((b) => show(answer(b)).split('.')[1]!.length === 2).length / mine.length, String(c)).toBeGreaterThanOrEqual(0.5)
    }
  })
})

describe('the marker', () => {
  it('takes each answer as a student would write it', () => {
    for (const g of structureGenerators) {
      for (const id of g.replaces) {
        for (const b of build(g.id, id, 200)) {
          const q = b.question
          if (q.type !== 'numeric') continue
          expect(mark(q, show(q.answer)).correct, `${g.id} ${b.seed}`).toBe(true)
          // An Rf or ratio a student rounds to three figures is marked right too (q6 asks one decimal place).
          if (g.id !== 'relative-atomic-mass-from-abundance') expect(mark(q, String(Number(q.answer.toPrecision(3)))).correct, `${g.id} ${b.seed}`).toBe(true)
        }
      }
    }
  })
})
