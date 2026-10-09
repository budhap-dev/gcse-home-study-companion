import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { roundTo, show } from '../format.ts'
import { sfTolerance } from '../physics/format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { atoms, mr, toPlaces } from './build.ts'
import { CONCENTRATION, concentrationGenerators } from './concentration.ts'

/**
 * Structural tests for the concentration and titration generators. Each reads the prompt's own
 * figures and equation back, works the answer again from them alone, and checks every printed
 * step: the volume in dm³, the moles, the ratio, the division. Across builds they check the
 * contexts rotate and that no answer or input fills a context.
 */
const TOPIC = 'concentrations-and-titrations'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/chemistry')
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bank.find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `structure-${i}`))
}

const clean = (x: number) => Number(x.toPrecision(12))
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const tenfold = (a: number, b: number) => {
  const l = Math.log10(Math.abs(a / b))
  return Math.abs(l - Math.round(l)) < 1e-9
}
const shifted = (a: number, b: number) => tenfold(a, b) || tenfold(a, 2 * b) || tenfold(2 * a, b)
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const places = (text: string) => (text.includes('.') ? text.split('.')[1]!.length : 0)
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
/** A whole number of 0.05 cm³ divisions. */
const figures = (x: number) => Number(x.toPrecision(3)) === x
const onScale = (x: number) => Math.abs(x * 20 - Math.round(x * 20)) < 1e-6
/** cm³ to dm³ as the working prints it: three places further on than the reading. */
const dm3 = (text: string) => {
  const v = Number(text) / 1000
  return places(text) ? v.toFixed(places(text) + 3) : show(v)
}

const SUB = '₀₁₂₃₄₅₆₇₈₉'
const unsub = (s: string) => s.replace(/[₀-₉]/g, (d) => String(SUB.indexOf(d)))
interface Term {
  n: number
  f: string
}
function equationIn(text: string): { left: Term[]; right: Term[] } {
  const m = /[A-Za-z0-9₀-₉()]+(?: \+ [A-Za-z0-9₀-₉()]+)* → [A-Za-z0-9₀-₉()]+(?: \+ [A-Za-z0-9₀-₉()]+)*/.exec(text)
  if (!m) throw new Error(`no equation in ${text}`)
  const side = (s: string) =>
    s.split(' + ').map((t) => {
      const x = /^(\d*)(.+)$/.exec(unsub(t))!
      return { n: x[1] ? Number(x[1]) : 1, f: x[2]! }
    })
  const [l, r] = m[0].split(' → ')
  return { left: side(l!), right: side(r!) }
}
const atomCount = (terms: Term[]) => {
  const out: Record<string, number> = {}
  for (const t of terms) for (const [s, k] of Object.entries(atoms(t.f))) out[s] = (out[s] ?? 0) + k * t.n
  return out
}
/** "(Mr of NaOH = 40)": the figure is mr() of the formula, which is returned. */
function mrGiven(prompt: string, seed: string): string {
  const m = /\(Mr of ([A-Za-z0-9₀-₉()]+) = (\d+(?:\.\d+)?)\)$/.exec(prompt)
  expect(m, `${seed}: ${prompt}`).not.toBeNull()
  expect(Number(m![2]), seed).toBe(mr(unsub(m![1]!)))
  return unsub(m![1]!)
}
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
  const many = build(id, slot, 1000)
  const a = worstShare(many, answer)
  expect(a.worst, `${id} answer`).toBeLessThanOrEqual(0.4)
  expect(a.fewest, `${id} answers per context`).toBeGreaterThanOrEqual(fewest)
  for (const k of keys) expect(worstShare(many, (b) => b.values[k]).worst, `${id} ${k}`).toBeLessThanOrEqual(0.4)
}

describe('every concentration and titration build', () => {
  it('has a generator for each numeric written slot but q1, a fact to recall', () => {
    expect(concentrationGenerators.flatMap((g) => g.replaces).sort()).toEqual(['q10', 'q11', 'q12', 'q15', 'q17', 'q2', 'q3', 'q5', 'q7', 'q9'])
    for (const g of concentrationGenerators) for (const id of g.replaces) expect(bank.find((q) => q.id === id)!.type).toBe('numeric')
    expect(bank.find((q) => q.id === 'q1')!.type).toBe('numeric')
  })

  it('prints no article before a figure, keeps the written units, and ends on the answer', () => {
    for (const g of concentrationGenerators) {
      for (const id of g.replaces) {
        for (const b of build(g.id, id, 150)) {
          expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          if (b.question.type === 'numeric') expect(b.question.units, b.seed).toBeUndefined()
          expect(b.question.solution, b.seed).toContain(String(answer(b)))
          expect(b.question.markScheme.at(-1)!.description).toBe(show(answer(b)))
          expect(tolerance(b), b.seed).toBeLessThanOrEqual(Math.abs(answer(b)) * 0.02)
        }
      }
    }
  })

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const g of concentrationGenerators) {
      for (const id of g.replaces) {
        const slot = bank.find((q) => q.id === id)!
        expect(() => {
          for (let i = 0; i < 3000; i++) generate(g, slot, `throw-${i}`)
        }, `${g.id} ${id}`).not.toThrow()
      }
    }
  })

  it('marks right an answer rounded to three significant figures, and to two where the givens carry two and 2% allows', () => {
    // q2 is an exact conversion and q9 asks for two decimal places: neither is a three-figure answer.
    const calculated = concentrationGenerators.filter((g) => !['concentration-cm3-to-dm3', 'titration-mean-titre'].includes(g.id))
    for (const g of calculated) {
      for (const id of g.replaces) {
        for (const b of build(g.id, id, 300)) {
          const q = b.question
          expect(mark(q, String(Number(answer(b).toPrecision(3)))).correct, `${g.id} ${b.seed}: ${answer(b)}`).toBe(true)
          // Two figures is half a unit in the second, capped at the release check's 2%: 0.0135 to 0.014 is 3.7% out.
          const two = Number(answer(b).toPrecision(2))
          if (['q5', 'q11', 'q12'].includes(id) && Math.abs(two - answer(b)) <= 0.019 * answer(b)) expect(mark(q, String(Number(answer(b).toPrecision(2)))).correct, `${g.id} ${b.seed}: ${answer(b)} to 2 s.f.`).toBe(true)
        }
      }
    }
  })

  it('names every substance it prints, and every equation is a real neutralisation that balances', () => {
    for (const t of [...CONCENTRATION.ONE_TO_ONE, ...CONCENTRATION.ONE_TO_TWO]) {
      expect(atomCount(t.eq.left)).toEqual(atomCount(t.eq.right))
      expect(t.eq.right.map((x) => x.f)).toContain('H2O')
      expect(t.eq.left.map((x) => x.f).sort()).toEqual([t.acid, t.alkali].sort())
      expect(['HCl', 'HNO3', 'H2SO4']).toContain(t.acid)
      expect(['NaOH', 'KOH']).toContain(t.alkali)
      for (const x of [...t.eq.left, ...t.eq.right]) expect(CONCENTRATION.called(x.f)).toMatch(/\w/)
    }
    // Every standard solution and titre is one a 50 cm³ burette and a lab's stock allow.
    for (const c of CONCENTRATION.STANDARD) expect(c >= 0.05 && c <= 2).toBe(true)
    for (const t of CONCENTRATION.TITRES) expect(onScale(t) && t >= 5 && t <= 50).toBe(true)
  })
})

describe('volumes and concentrations', () => {
  it('q2: cm³ to dm³, the figure read to the places of its context', () => {
    const built = build('concentration-cm3-to-dm3', 'q2')
    for (const b of built) {
      const text = /(\d+(?:\.\d+)?) cm³/.exec(b.question.prompt)![1]!
      const c = CONCENTRATION.VOLUMES.find((x) => x.name === b.values.context)!
      expect(places(text), b.seed).toBe(c.dp)
      if (c.dp === 2) expect(onScale(Number(text))).toBe(true)
      expect(answer(b)).toBe(clean(Number(text) / 1000))
      expect(b.question.solution).toContain(`${text} \\div 1000 = $ **${dm3(text)} dm³**`)
      expect([1, 10, 100, 1000]).not.toContain(Number(text))
      expect(tolerance(b)).toBe(toPlaces(answer(b), Math.max(places(show(answer(b))), c.dp + 3)))
    }
    expect(contexts(built)).toBe(4)
    spread('concentration-cm3-to-dm3', 'q2', ['v'])
  })

  it('q3: g/dm³ from a mass in a volume made up, the conversion its method line', () => {
    const built = build('concentration-g-per-dm3', 'q3')
    for (const b of built) {
      const p = b.question.prompt
      const m = Number(/(\d+(?:\.\d+)?) g of/.exec(p)![1])
      const v = Number(/(\d+) cm³/.exec(p)![1])
      expect(p).toContain(`${CONCENTRATION.called(String(b.values.context))} `)
      expect(p).toContain('g/dm³')
      expect(answer(b)).toBe(clean(m / (v / 1000)))
      expect(method(b)).toEqual([`${show(v / 1000)} dm3`])
      expect(b.question.solution).toContain(`\\dfrac{${show(m)}}{${show(v / 1000)}} = $ **${show(answer(b))} g/dm³**`)
      expect([100, 1000]).not.toContain(v)
      expect(m >= 0.5 && m <= 60 && answer(b) <= 150).toBe(true)
      expect(shifted(answer(b), m) || shifted(answer(b), v)).toBe(false)
      expect(tolerance(b)).toBe(toPlaces(answer(b), Math.max(places(show(answer(b))), places(show(m)))))
    }
    expect(contexts(built)).toBe(CONCENTRATION.SOLUTES.length)
    spread('concentration-g-per-dm3', 'q3', ['m', 'v'])
  })

  it('q5: moles from a concentration and a volume, converted to dm³ first', () => {
    const built = build('concentration-moles-in-solution', 'q5')
    for (const b of built) {
      const p = b.question.prompt
      const [, vText, cText] = /(\d+(?:\.\d+)?) cm³ of (\d+\.\d+) mol\/dm³/.exec(p)!
      const portion = CONCENTRATION.PORTIONS.find((x) => x.name === b.values.context)!
      expect(places(vText!), b.seed).toBe(portion.dp)
      expect(cText!.replace('.', '').replace(/^0+/, '').length, `${b.seed}: ${cText} to three figures`).toBe(3)
      const [v, c] = [Number(vText), Number(cText)]
      if (portion.name === 'burette') expect(onScale(v) && v >= 12 && v <= 45).toBe(true)
      expect(c >= 0.05 && c <= 2).toBe(true)
      expect(answer(b)).toBe(clean((c * v) / 1000))
      expect(method(b)).toEqual([`converts to ${dm3(vText!)} dm3`])
      expect(b.question.solution).toContain(`${cText} \\times ${dm3(vText!)} = $`)
      expect(Number(answer(b).toPrecision(3))).toBe(answer(b))
      expect(shifted(answer(b), c) || shifted(answer(b), v)).toBe(false)
      expect([0.1, 1, 10, 100]).not.toContain(c)
    }
    expect(contexts(built)).toBe(3)
    spread('concentration-moles-in-solution', 'q5', ['c', 'formula'])
    // The pipette is always 25.0 cm³ (20.0 and 50.0 double or halve c with the point moved); the others vary.
    const free = build('concentration-moles-in-solution', 'q5', 1000).filter((b) => b.values.context !== 'pipette')
    expect(worstShare(free, (b) => b.values.v).worst).toBeLessThanOrEqual(0.4)
  })

  it('q7: mol/dm³ to g/dm³ by the Mr printed, the Mr computed', () => {
    const built = build('concentration-mol-to-grams', 'q7')
    for (const b of built) {
      const f = mrGiven(b.question.prompt, b.seed)
      expect(f).toBe(b.values.context)
      const c = Number(/(\d+(?:\.\d+)?) mol\/dm³/.exec(b.question.prompt)![1])
      const d = CONCENTRATION.DISSOLVED.find((x) => x.f === f)!
      expect(c >= 0.05 && c <= d.max).toBe(true)
      expect(figures(answer(b))).toBe(true)
      expect(tenfold(c, mr(f))).toBe(false)
      expect(answer(b)).toBe(clean(c * mr(f)))
      expect(method(b)).toEqual([`multiplies ${show(c)} by the Mr, ${show(mr(f))}`])
      // 0.1, 0.2 and 0.05 make the answer the Mr, doubled or halved, with the point moved.
      expect(tenfold(c, 1) || tenfold(c, 2) || tenfold(c, 5)).toBe(false)
      expect(shifted(answer(b), mr(f))).toBe(false)
    }
    expect(contexts(built)).toBe(CONCENTRATION.DISSOLVED.length)
    spread('concentration-mol-to-grams', 'q7', ['c'])
  })

  it('q10: moles from the mass, the volume in dm³, then their quotient', () => {
    const built = build('concentration-mol-from-mass', 'q10')
    for (const b of built) {
      const f = mrGiven(b.question.prompt, b.seed)
      const m = Number(/(\d+(?:\.\d+)?) g of/.exec(b.question.prompt)![1])
      const v = Number(/(\d+) cm³/.exec(b.question.prompt)![1])
      const n = clean(m / mr(f))
      expect(method(b)).toEqual([`${show(n)} mol`, `${show(v / 1000)} dm3`])
      expect(answer(b)).toBe(clean(n / (v / 1000)))
      expect(b.question.solution).toContain(`\\dfrac{${show(m)}}{${show(mr(f))}} = ${show(n)}$`)
      expect(b.question.solution).toContain(`\\dfrac{${show(n)}}{${show(v / 1000)}} = $ **${show(answer(b))} mol/dm³**`)
      const d = CONCENTRATION.WEIGHED.find((x) => x.f === f)!
      expect(answer(b) >= 0.05 && answer(b) <= d.max).toBe(true)
      expect(m >= 0.5 && m <= 60).toBe(true)
      expect([100, 1000]).not.toContain(v)
      expect(tenfold(n, 1)).toBe(false)
      expect(shifted(answer(b), n) || shifted(answer(b), m) || shifted(answer(b), v)).toBe(false)
    }
    expect(contexts(built)).toBe(CONCENTRATION.WEIGHED.length)
    spread('concentration-mol-from-mass', 'q10', ['v', 'm'])
  })
})

describe('the mean titre', () => {
  it('q9: three concordant titres on the burette scale, a repeat among them, the mean to two places', () => {
    const built = build('titration-mean-titre', 'q9')
    for (const b of built) {
      const p = b.question.prompt
      const all = [...p.matchAll(/(\d+\.\d\d)/g)].map((m) => Number(m[1]))
      const rough = b.values.context === 'rough titre first'
      const xs = rough ? all.slice(1) : all
      expect(xs, b.seed).toHaveLength(3)
      for (const x of all) expect(onScale(x) && x >= 12 && x <= 50, `${b.seed}: ${x}`).toBe(true)
      expect(Math.max(...xs) - Math.min(...xs) <= 0.1 + 1e-9).toBe(true)
      // Two agree, so the mean is none of them: "pick the middle one" never pays.
      expect(new Set(xs).size).toBe(2)
      const mean = (xs[0]! + xs[1]! + xs[2]!) / 3
      expect(answer(b)).toBe(roundTo(mean, 2))
      for (const x of xs) expect(near(answer(b), x)).toBe(false)
      expect(method(b)).toEqual([`adds the three concordant titres: ${(xs[0]! + xs[1]! + xs[2]!).toFixed(2)}`])
      expect(b.question.solution).toContain(`**${answer(b).toFixed(2)} cm³**`)
      expect(p).toContain('two decimal places')
      expect(tolerance(b)).toBe(toPlaces(answer(b), 2))
      if (rough) {
        // The rough titre overshoots, and averaging it in would be marked wrong.
        expect(all[0]! - Math.max(...xs) >= 0.4 - 1e-9).toBe(true)
        expect(Math.abs((all[0]! + xs[0]! + xs[1]! + xs[2]!) / 4 - answer(b)) > tolerance(b)).toBe(true)
      }
    }
    expect(contexts(built)).toBe(3)
    spread('titration-mean-titre', 'q9', ['low'])
  })
})

interface Read {
  v: number
  titre: number
  ck: number
  unknown: 'acid' | 'alkali'
  acid: string
  alkali: string
  k: number
}
/** The pipette, the titre, the burette's concentration and the equation's ratio, read from the prompt. */
function readTitration(b: Generated): Read {
  const p = b.question.prompt
  const eq = equationIn(p)
  expect(atomCount(eq.left), b.seed).toEqual(atomCount(eq.right))
  const v = Number(/(\d+\.\d) cm³ of/.exec(p)![1])
  const titre = Number((/by (\d+\.\d\d) cm³/.exec(p) ?? /titre (?:is|of) (\d+\.\d\d) cm³/.exec(p))![1])
  const cText = /(\d+\.\d+) mol\/dm³/.exec(p)![1]!
  expect(cText.replace('.', '').replace(/^0+/, '').length, `${b.seed}: ${cText}`).toBe(3)
  const unknown = /concentration of the (acid|alkali)/.exec(p)?.[1] as 'acid' | 'alkali' | undefined
  const acid = eq.left.find((t) => t.f.startsWith('H'))!
  const alkali = eq.left.find((t) => !t.f.startsWith('H'))!
  const u = unknown ?? (/concentration of the (\w+ \w+)/.exec(p)![1]!.endsWith('acid') ? 'acid' : 'alkali')
  const [uT, kT] = u === 'acid' ? [acid, alkali] : [alkali, acid]
  return { v, titre, ck: Number(cText), unknown: u, acid: acid.f, alkali: alkali.f, k: uT.n / kT.n }
}

describe('titrations', () => {
  for (const [id, slot] of [
    ['titration-concentration', 'q11'],
    ['titration-concentration-sulfuric', 'q12'],
  ] as const) {
    it(`${slot}: moles from the burette, the ratio from the equation, then over the pipette's volume`, () => {
      const built = build(id, slot)
      let halves = 0
      for (const b of built) {
        const x = readTitration(b)
        expect([20, 25]).toContain(x.v)
        expect(onScale(x.titre) && x.titre >= 12 && x.titre <= 45).toBe(true)
        expect(x.ck >= 0.05 && x.ck <= 2).toBe(true)
        expect(x.k).toBe(slot === 'q11' ? 1 : x.unknown === 'alkali' ? 2 : 0.5)
        if (x.k < 1) halves++
        const nk = clean((x.ck * x.titre) / 1000)
        const nu = clean(nk * x.k)
        const cu = clean(nu / (x.v / 1000))
        expect(answer(b), b.seed).toBe(cu)
        expect(cu >= 0.05 && cu < 1).toBe(true)
        // Every amount the working prints is exact at three figures, so rounding each step to three lands on the answer.
        expect(figures(nk) && figures(nu), `${b.seed}: ${nk} ${nu}`).toBe(true)
        const route = Number((Number(Number(Number(nk.toPrecision(3)) * x.k).toPrecision(3)) / (x.v / 1000)).toPrecision(3))
        expect(Math.abs(route - cu) <= tolerance(b) + 1e-9, `${b.seed}: ${route}`).toBe(true)
        expect(Number(cu.toPrecision(3))).toBe(cu)
        const other = x.unknown === 'acid' ? 'alkali' : 'acid'
        const lines = method(b)
        expect(lines[0]).toMatch(new RegExp(`^moles of ${other} = `))
        expect(Number(lines[0]!.split(' = ')[1])).toBe(nk)
        expect(lines.at(-1)).toBe(`divides by ${x.v === 20 ? '0.0200' : '0.0250'}`)
        if (slot === 'q12') expect(lines[1]).toBe(`${x.k > 1 ? 'doubles' : 'halves'} for the 1 : 2 ratio`)
        expect(b.question.solution).toContain(`\\times ${(x.titre / 1000).toFixed(5)} = `)
        expect(b.question.solution).toContain(`mol/dm³**`)
        // No figure printed is the answer, doubled or halved, with or without the point moved.
        for (const g of [x.ck, x.titre, x.v]) expect(shifted(cu, g), `${b.seed}: ${g}`).toBe(false)
        expect(tolerance(b)).toBe(sfTolerance(cu, 2))
      }
      expect(contexts(built)).toBe(4)
      // The ratio step doubles about half the time and halves the rest: "always double" fails half.
      if (slot === 'q12') expect(halves / built.length > 0.35 && halves / built.length < 0.65).toBe(true)
      spread(id, slot, ['ck', 'titre'])
    })
  }

  it('q15: the titration, then the concentration times the Mr printed', () => {
    const built = build('titration-concentration-in-grams', 'q15')
    for (const b of built) {
      const x = readTitration(b)
      const f = mrGiven(b.question.prompt, b.seed)
      expect(f).toBe(x.unknown === 'acid' ? x.acid : x.alkali)
      expect(x.k).toBe(1)
      const cu = clean((x.ck * x.titre) / x.v)
      expect(answer(b)).toBe(clean(cu * mr(f)))
      expect(figures(answer(b)) && figures(cu) && figures(clean((x.ck * x.titre) / 1000))).toBe(true)
      // The route a student rounds to three figures at each step lands within the tolerance.
      const n3 = Number(((x.ck * x.titre) / 1000).toPrecision(3))
      const c3 = Number((n3 / (x.v / 1000)).toPrecision(3))
      expect(Math.abs(Number((c3 * mr(f)).toPrecision(3)) - answer(b)) <= tolerance(b) + 1e-9, b.seed).toBe(true)
      // No concentration or titre is the Mr with the point moved (0.400 or 40.00 beside NaOH = 40).
      for (const g of [x.ck, x.titre, x.v]) expect(tenfold(g, mr(f)), `${b.seed}: ${g}`).toBe(false)
      expect(method(b)[1]).toBe(`concentration ${Number(cu.toPrecision(3)) === cu ? cu.toPrecision(3) : show(cu)} mol/dm3`)
      expect(method(b)[2]).toBe(`multiplies by the Mr, ${show(mr(f))}`)
      expect(onScale(x.titre) && x.titre >= 12 && x.titre <= 45).toBe(true)
      for (const g of [mr(f), cu, x.ck, x.titre, x.v]) expect(shifted(answer(b), g), `${b.seed}: ${g}`).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    spread('titration-concentration-in-grams', 'q15', ['ck', 'titre'])
  })

  it('q17: the volume of the burette solution, moles over its concentration', () => {
    const built = build('titration-volume-needed', 'q17')
    for (const b of built) {
      const p = b.question.prompt
      const eq = equationIn(p)
      expect(atomCount(eq.left)).toEqual(atomCount(eq.right))
      expect(eq.left.every((t) => t.n === 1)).toBe(true)
      const cs = [...p.matchAll(/(\d+\.\d+) mol\/dm³ (sodium hydroxide|potassium hydroxide|hydrochloric acid|nitric acid)/g)].map((m) => ({ c: Number(m[1]), name: m[2]! }))
      expect(cs).toHaveLength(2)
      const v = Number(/(\d+\.\d) cm³ of/.exec(p)![1])
      // The burette's solution is the one whose volume is asked for.
      const asked = /volume(?:, in cm³,)? of (?:\d+\.\d+ mol\/dm³ )?(sodium hydroxide|potassium hydroxide|hydrochloric acid|nitric acid)/.exec(p)![1]!
      const cb = cs.find((x) => x.name === asked)!.c
      const cp = cs.find((x) => x.name !== asked)!.c
      expect(cb).not.toBe(cp)
      const n = clean((cp * v) / 1000)
      expect(answer(b)).toBe(clean((n / cb) * 1000))
      expect(onScale(answer(b)) && answer(b) >= 12 && answer(b) <= 45).toBe(true)
      expect(Number(method(b)[0]!.split(' = ')[1])).toBe(n)
      expect(method(b)[1]).toBe('divides moles by concentration')
      expect(b.question.solution).toContain(`**${answer(b).toFixed(2)} cm³**`)
      expect(shifted(answer(b), v) || shifted(answer(b), cp) || shifted(answer(b), cb)).toBe(false)
      expect(tolerance(b)).toBe(0.05)
    }
    expect(contexts(built)).toBe(4)
    // Whole titres divide most cleanly; they are about one answer in ten, not a third.
    const many = build('titration-volume-needed', 'q17', 2000)
    expect(many.filter((b) => Number.isInteger(answer(b))).length / many.length).toBeLessThanOrEqual(0.15)
    spread('titration-volume-needed', 'q17', ['cb', 'cp'])
  })
})
