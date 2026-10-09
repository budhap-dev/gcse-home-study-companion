import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import { dpTolerance } from '../physics/format.ts'
import type { Generated } from '../types.ts'
import { AR, atoms, mr, mrWorking, parse } from './build.ts'
import { COMPOUNDS, ORES } from './compounds.ts'
import { FORMULAE_POOLS } from './formulae.ts'

/**
 * Structural tests for the formulae generators. The release check proves each answer agrees
 * with a second route; these read the prompt's own formula and relative atomic masses back,
 * work the answer from them, and check each printed step of the working, because a right
 * answer can be reached by a wrong route. They also look across a run of builds for what no
 * single build can show: a context that never rotates, or one answer carrying a slot.
 */
const TOPIC = 'formulae-and-balancing-equations'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/chemistry')
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  expect(g.topicId).toBe(TOPIC)
  const slot = bank.find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `structure-${i}`))
}

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const units = (b: Generated) => (b.question.type === 'numeric' ? b.question.units : 'not numeric')
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const last = (b: Generated) => b.question.markScheme.at(-1)!.description
const values = (b: Generated) => b.values as Record<string, any>
const clean = (x: number) => Number(x.toPrecision(12))
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context))
const tenfold = (a: number, b: number) => Math.abs(Math.log10(Math.abs(a / b)) - Math.round(Math.log10(Math.abs(a / b)))) < 1e-9
/** The share of builds the commonest value takes. */
const share = (xs: unknown[]) => {
  const counts = new Map<unknown, number>()
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1)
  return Math.max(...counts.values()) / xs.length
}
/** Every build's prompt: no "a 8 g", which reads "an eight". */
const noArticle = (b: Generated) => expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
/** "Relative atomic masses: K 39, N 14, O 16." read back from the prompt. */
function arsIn(prompt: string): Record<string, number> {
  const m = /Relative atomic masses: ((?:[A-Z][a-z]? \d+(?:\.\d+)?(?:, )?)+)\./.exec(prompt)
  expect(m, prompt).not.toBeNull()
  return Object.fromEntries(m![1]!.split(', ').map((pair) => {
    const [s, v] = pair.split(' ')
    return [s!, Number(v)]
  }))
}
/** Mr worked from the prompt's own Ars, element by element. */
const mrFrom = (formula: string, ars: Record<string, number>) => clean(Object.entries(atoms(formula)).reduce((t, [s, n]) => t + n * ars[s]!, 0))
/** The prompt's Ars are the insert's, one for each element of the formula, in the formula's order. */
function arsOk(b: Generated, formula: string) {
  const ars = arsIn(b.question.prompt)
  expect(Object.keys(ars), b.seed).toEqual(Object.keys(atoms(formula)))
  for (const [s, v] of Object.entries(ars)) expect(v, `${b.seed} ${s}`).toBe(AR[s])
  return ars
}
const NAME: Record<string, string> = { H: 'hydrogen', O: 'oxygen', C: 'carbon', N: 'nitrogen', S: 'sulfur', Cl: 'chlorine', Na: 'sodium', Ca: 'calcium', Al: 'aluminium', Fe: 'iron', Li: 'lithium', Si: 'silicon', P: 'phosphorus', K: 'potassium', Mg: 'magnesium', Cu: 'copper', Zn: 'zinc', Pb: 'lead', Sn: 'tin', Mn: 'manganese', Ti: 'titanium', F: 'fluorine', Ba: 'barium', Ag: 'silver' }
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']

describe('counting atoms', () => {
  const built = build('atoms-in-a-formula', 'q2', 600)

  it('reads the multiplier and formula from the prompt and multiplies the subscript by the multiplier', () => {
    for (const b of built) {
      const { formula, symbol, k, n } = values(b)
      noArticle(b)
      const written = /in (\d)([A-Za-z0-9()]+)\?|contains (\d)([A-Za-z0-9()]+)\.|shown by (\d)([A-Za-z0-9()]+)\?/.exec(b.question.prompt)
      expect(written, b.seed).not.toBeNull()
      const [kRead, fRead] = written![1] ? [written![1], written![2]] : written![3] ? [written![3], written![4]] : [written![5], written![6]]
      expect(Number(kRead)).toBe(k)
      expect(fRead).toBe(formula)
      expect(b.question.prompt).toContain(NAME[symbol]!)
      // Each element appears once, outside brackets, so its count is its subscript.
      expect(parse(formula).every((p) => 'symbol' in p)).toBe(true)
      expect(atoms(formula)[symbol]).toBe(n)
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).not.toBe(10)
      expect(k >= 2 && k <= 8).toBe(true)
      // The multiplier is none of the formula's subscripts, and 2 × 2 (= 2 + 2) never appears.
      expect((formula.match(/\d+/g) ?? []).map(Number)).not.toContain(k)
      expect(k === 2 && n === 2).toBe(false)
      expect(answer(b)).toBe(k * n)
      expect(answer(b)).toBeLessThanOrEqual(48)
      expect(b.question.solution).toBe(`The subscript gives ${n} ${NAME[symbol]} atoms in each ${formula}, and the multiplier gives ${k} of them: $${k} \\times ${n} = ${k * n}$.`)
      expect(method(b)).toEqual([`multiplies the subscript ${n} by the multiplier ${k}`])
      expect(last(b)).toBe(String(k * n))
      expect(units(b)).toBeUndefined()
      expect(tolerance(b)).toBe(0)
    }
  })

  it('rotates hydrogen, oxygen and other elements, each with many answers and none carrying it', () => {
    expect(contexts(built)).toEqual(new Set(FORMULAE_POOLS.countContexts))
    for (const name of FORMULAE_POOLS.countContexts) {
      const mine = built.filter((b) => b.values.context === name)
      expect(new Set(mine.map(answer)).size, name).toBeGreaterThanOrEqual(10)
      expect(share(mine.map(answer)), name).toBeLessThanOrEqual(0.2)
      expect(share(mine.map((b) => b.values.formula)), name).toBeLessThanOrEqual(0.4)
      expect(share(mine.map((b) => b.values.k)), name).toBeLessThanOrEqual(0.4)
    }
  })
})

describe('relative formula mass', () => {
  const slots = { q3: 'two', q5: 'three', q6: 'brackets', q10: 'three' } as const
  const built = Object.fromEntries(Object.keys(slots).map((id) => [id, build('relative-formula-mass', id, 400)])) as Record<keyof typeof slots, Generated[]>

  it('asks each slot about its own kind of compound', () => {
    for (const [id, kind] of Object.entries(slots) as [keyof typeof slots, string][]) {
      for (const b of built[id]) {
        const parts = parse(values(b).formula)
        const groups = parts.filter((p) => !('symbol' in p))
        if (kind === 'brackets') expect(groups.length, b.seed).toBe(1)
        else {
          expect(groups.length).toBe(0)
          expect(parts.length, b.seed).toBe(kind === 'two' ? 2 : 3)
          expect(parts.some((p) => p.n >= 2)).toBe(true)
        }
      }
    }
  })

  it('works the Mr from the prompt’s own Ars and prints the written working', () => {
    for (const [id, kind] of Object.entries(slots) as [keyof typeof slots, string][]) {
      for (const b of built[id]) {
        const { formula } = values(b)
        noArticle(b)
        expect(b.question.prompt, b.seed).toContain(` ${formula}`)
        const ars = arsOk(b, formula)
        const M = mrFrom(formula, ars)
        expect(answer(b), b.seed).toBe(M)
        expect(M).toBe(mr(formula))
        expect(units(b)).toBeUndefined()
        expect(tolerance(b)).toBe(dpTolerance(M))
        expect(last(b)).toBe(show(M))
        // A fact, where the prompt gives one, is the table's, after the compound's name.
        const c = COMPOUNDS[formula]!
        expect(c.fact).toBeDefined()
        if (b.question.prompt.includes(c.fact!)) expect(b.question.prompt).toContain(`${c.name[0]!.toUpperCase()}${c.name.slice(1)}, ${formula}, ${c.fact}.`)
        if (kind === 'two') {
          expect(b.question.solution).toBe(`$${mrWorking(formula)} = ${show(M)}$.`)
          const counted = parse(formula).flatMap((p) => ('symbol' in p && p.n > 1 ? [`${WORDS[p.n]} ${NAME[p.symbol]} atoms`] : []))
          expect(method(b)).toEqual([`counts ${counted.join(' and ')}`])
        }
        if (kind === 'three') {
          // The middle step: each element's mass, adding to the Mr.
          const m = /^\$(.+) = (.+) = (.+)\$\.$/.exec(b.question.solution)
          expect(m, b.seed).not.toBeNull()
          expect(m![1]).toBe(mrWorking(formula))
          const each = m![2]!.split(' + ').map(Number)
          expect(each).toEqual(parse(formula).map((p) => ('symbol' in p ? clean(p.n * ars[p.symbol]!) : NaN)))
          expect(clean(each.reduce((a, x) => a + x, 0))).toBe(M)
          expect(Number(m![3])).toBe(M)
          expect(method(b)[1]).toBe('adds all three elements')
          expect(method(b)[0]).toMatch(/^multiplies \w+ by \w+/)
        }
        if (kind === 'brackets') {
          const k = Number(/\)(\d+)/.exec(formula)![1])
          const wrongFormula = formula.replace(/\)\d+/, ')')
          const wrong = mrFrom(wrongFormula, ars)
          expect(wrong).not.toBe(M)
          expect(b.question.solution).toBe(`The subscript applies to everything in the brackets: $${mrWorking(formula)} = ${show(M)}$. Reading it as $${mrWorking(wrongFormula)} = ${show(wrong)}$ is the commonest error.`)
          expect(method(b)[0]).toBe(`applies the subscript ${k} to everything in the brackets`)
          // The outside step names each element outside the bracket with its count, and those
          // figures plus k times the bracket make the Mr.
          const outside = parse(formula).flatMap((p) => ('symbol' in p ? [p] : []))
          const named = [...method(b)[1]!.matchAll(/(?:\$(\d+) \\times ([\d.]+)\$|([\d.]+)) for the ([a-z]+)/g)].map((m) => ({
            n: m[1] ? Number(m[1]) : 1,
            ar: Number(m[2] ?? m[3]),
            name: m[4],
          }))
          expect(method(b)[1]).toMatch(/^adds /)
          expect(named, b.seed).toEqual(outside.map((p) => ({ n: p.n, ar: ars[p.symbol], name: NAME[p.symbol] })))
          const group = parse(formula).find((p) => !('symbol' in p))!
          const inner = 'group' in group ? group.group.reduce((t, q) => t + ('symbol' in q ? q.n * ars[q.symbol]! : NaN), 0) : NaN
          expect(clean(named.reduce((t, x) => t + x.n * x.ar, 0) + k * inner)).toBe(M)
        }
      }
    }
  })

  it('rotates three families per slot, none carried by one compound', () => {
    for (const id of Object.keys(slots) as (keyof typeof slots)[]) {
      expect(contexts(built[id]).size, id).toBe(3)
      for (const name of contexts(built[id])) {
        const mine = built[id].filter((b) => b.values.context === name)
        expect(share(mine.map(answer)), `${id} ${name}`).toBeLessThanOrEqual(0.4)
        expect(new Set(mine.map(answer)).size, `${id} ${name}`).toBeGreaterThanOrEqual(5)
      }
      expect(share(built[id].map((b) => b.values.template))).toBeLessThanOrEqual(0.25)
    }
  })

  it('names every compound and knows one true thing about it', () => {
    for (const families of Object.values(FORMULAE_POOLS.mrFamilies)) for (const f of families.flatMap((x) => x.formulae)) expect(COMPOUNDS[f], f).toBeDefined()
  })
})

describe('percentage by mass', () => {
  const exact = build('percentage-by-mass', 'q8', 600)
  const rounded = build('percentage-by-mass-rounded', 'q16', 600)

  it('divides the element’s mass by the Mr from the prompt’s own Ars', () => {
    for (const [built, isRounded] of [[exact, false], [rounded, true]] as const) {
      for (const b of built) {
        const { formula, symbol } = values(b)
        noArticle(b)
        expect(b.question.prompt, b.seed).toContain(formula)
        expect(b.question.prompt).toContain(NAME[symbol]!)
        const ars = arsOk(b, formula)
        const M = mrFrom(formula, ars)
        const n = atoms(formula)[symbol]!
        const mass = clean(n * ars[symbol]!)
        const pct = (100 * mass) / M
        const ans = answer(b)
        expect(units(b)).toBe('%')
        expect(tolerance(b)).toBe(dpTolerance(ans))
        expect(last(b)).toBe(`${show(ans)}%`)
        const fraction = `\\dfrac{${show(mass)}}{${show(M)}} \\times 100`
        expect(b.question.solution).toContain(`$M_r = `)
        expect(b.question.solution).toContain(` = ${show(M)}$`)
        expect(b.question.solution).toContain(n === 1 ? `there is one ${NAME[symbol]} of mass ${show(mass)}` : `have mass $${n} \\times ${show(ars[symbol]!)} = ${show(mass)}$`)
        if (isRounded) {
          expect(b.question.prompt).toMatch(/Give your answer to 1 decimal place\.$/)
          expect(ans).toBe(Math.round(pct * 10) / 10)
          // It needs rounding, is clear of a half-way case, and does not round to a whole number.
          expect(Math.abs(pct * 10 - Math.round(pct * 10))).toBeGreaterThan(1e-6)
          expect(Math.abs(pct * 10 - Math.floor(pct * 10) - 0.5)).toBeGreaterThan(0.02)
          expect(Number.isInteger(ans)).toBe(false)
          expect(Math.abs(pct - ans)).toBeLessThanOrEqual(tolerance(b))
          expect(b.question.solution).toContain(`$${fraction} = ${pct.toFixed(3)}\\ldots$, which is ${show(ans)}% to 1 decimal place.`)
          expect(method(b)).toEqual([`finds the $M_r$ as ${show(M)}`, `divides ${show(mass)} by ${show(M)}`])
        } else {
          expect(b.question.prompt).not.toContain('decimal place')
          expect(ans).toBe(clean(pct))
          expect(Math.abs(ans * 10 - Math.round(ans * 10))).toBeLessThan(1e-9)
          expect(ans).not.toBe(50)
          expect(b.question.solution).toContain(`$${fraction} = ${show(ans)}\\%$.`)
          expect(method(b)[1]).toBe(`divides the ${NAME[symbol]} mass, ${show(mass)}, by the $M_r$`)
        }
        expect(ans >= 5 && ans <= 95).toBe(true)
        // Never a printed Ar, the element's mass or the Mr, with the point moved, doubled or halved.
        for (const g of [...Object.values(ars), mass, M]) {
          expect(tenfold(ans, g), `${b.seed} ${ans} ${g}`).toBe(false)
          expect(clean(2 * g)).not.toBe(ans)
          expect(clean(2 * ans)).not.toBe(g)
        }
      }
    }
  })

  it('says fewer atoms carry more of the mass only when they do', () => {
    for (const b of rounded) {
      const { formula, symbol } = values(b)
      const m = /([A-Z][a-z]+) (\w+) atoms against (?:one|\w+) (\w+)(?: atoms)?, yet the (\w+) weighs more: ([\d.]+) against ([\d.]+)\./.exec(b.question.solution)
      if (b.values.context === 'fewer atoms, more mass') expect(m, b.seed).not.toBeNull()
      if (!m) continue
      const count = (w: string) => WORDS.indexOf(w.toLowerCase())
      const other = Object.keys(NAME).find((s) => NAME[s] === m[2])!
      expect(m[3]).toBe(NAME[symbol])
      expect(m[4]).toBe(NAME[symbol])
      expect(count(m[1]!)).toBe(atoms(formula)[other])
      expect(atoms(formula)[other]!).toBeGreaterThan(atoms(formula)[symbol]!)
      expect(Number(m[5])).toBe(atoms(formula)[symbol]! * AR[symbol]!)
      expect(Number(m[6])).toBe(atoms(formula)[other]! * AR[other]!)
      expect(Number(m[6])).toBeLessThan(Number(m[5]))
    }
  })

  it('names an ore by its mineral and a fertiliser by an element it supplies', () => {
    for (const b of rounded) {
      const { formula, symbol } = values(b)
      if (b.values.context === 'fertilisers') expect(['N', 'P', 'K']).toContain(symbol)
      if (b.values.context === 'ores') {
        expect(['C', 'O', 'S']).not.toContain(symbol)
        if (b.question.prompt.includes('ore')) expect(b.question.prompt.toLowerCase()).toContain(ORES[formula]!.name)
      }
    }
  })

  it('rotates its families, every answer drawn evenly', () => {
    for (const [built, families] of [[exact, 2], [rounded, 3]] as const) {
      expect(contexts(built).size).toBe(families)
      expect(share(built.map(answer))).toBeLessThanOrEqual(0.2)
      for (const name of contexts(built)) {
        const mine = built.filter((b) => b.values.context === name)
        expect(share(mine.map(answer)), String(name)).toBeLessThanOrEqual(0.25)
        expect(share(mine.map((b) => b.values.formula)), String(name)).toBeLessThanOrEqual(0.4)
        expect(new Set(mine.map(answer)).size, String(name)).toBeGreaterThanOrEqual(5)
      }
    }
    for (const f of FORMULAE_POOLS.rounded()) expect(new Set(f.shares.map((s) => s.answer)).size, f.name).toBeGreaterThanOrEqual(9)
  })
})
