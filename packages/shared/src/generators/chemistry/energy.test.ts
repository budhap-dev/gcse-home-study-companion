import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { fixed } from '../format.ts'
import { tex } from '../physics/build.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { atoms, balanced, clearOf, count, toPlaces } from './build.ts'
import { BOND_ENERGY, BONDS, ENERGY, bondsOf, energyGenerators, printed, total } from './energy.ts'

/**
 * Structural tests for the energy-change generators. Each reads the prompt's own temperatures or
 * totals back, works the answer again from them alone, and checks every printed step: the
 * subtraction in its right order, the three repeats kept and the anomaly dropped, each bond
 * counted from the molecule's structure and priced at its average energy. Across builds they
 * check every reaction turns up, warming ones only where the slot asks for a rise and cooling ones
 * only where it asks for a sign, and that no answer or input fills a context.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/chemistry')
const bankOf = (topic: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bankOf(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `structure-${i}`))
}

const clean = (x: number) => Number(x.toPrecision(12))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const last = (b: Generated) => b.question.markScheme.at(-1)!.description
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
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
const cup = (b: Generated) => [...ENERGY.WARMING, ...ENERGY.COOLING].find((c) => c.name === b.values.context)!

describe('every energy build', () => {
  it('has a generator for each numeric written slot it can vary, and leaves the alcohols written', () => {
    const claimed = energyGenerators.map((g) => `${g.topicId}/${[...g.replaces].sort().join(',')}`).sort()
    expect(claimed).toEqual(['exothermic-and-endothermic-reactions/q11', 'exothermic-and-endothermic-reactions/q5,q7', 'reaction-profiles-and-bond-energies/q11', 'reaction-profiles-and-bond-energies/q7'])
    expect(bankOf('exothermic-and-endothermic-reactions').filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(['q11', 'q5', 'q7'])
    expect(bankOf('reaction-profiles-and-bond-energies').filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(['q11', 'q7'])
    // Balancing an alcohol's combustion: four alcohols, four equations, nothing to vary.
    expect(GENERATORS.some((g) => g.topicId === 'alcohols')).toBe(false)
  })

  it('prints no article before a figure, keeps the written units, and reaches the answer', () => {
    for (const g of energyGenerators) {
      for (const id of g.replaces) {
        const slot = bankOf(g.topicId).find((q) => q.id === id)!
        for (const b of build(g.id, id, 150)) {
          expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          expect(b.question.type === 'numeric' && b.question.units, b.seed).toBe(slot.type === 'numeric' && slot.units)
          expect(b.question.solution, b.seed).toContain(String(answer(b)))
          expect(b.question.prompt).toMatch(/in (°C|kJ\/mol)[?.]$/)
          expect(mark(b.question, String(answer(b))).correct, b.seed).toBe(true)
        }
      }
    }
  })

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const g of energyGenerators) {
      for (const id of g.replaces) {
        const slot = bankOf(g.topicId).find((q) => q.id === id)!
        expect(() => {
          for (let i = 0; i < 3000; i++) generate(g, slot, `throw-${i}`)
        }, `${g.id} ${id}`).not.toThrow()
      }
    }
  })
})

describe('temperature changes in a polystyrene cup (required practical 4)', () => {
  it('names only reactions the practical lists, each changing by what a cup of dilute solution gives', () => {
    for (const c of ENERGY.WARMING) {
      expect(c.warms).toBe(true)
      expect(c.text).toContain('polystyrene cup')
      expect(c.change[1]).toBeLessThanOrEqual(20)
    }
    for (const c of ENERGY.COOLING) {
      expect(c.warms).toBe(false)
      expect(c.text).toMatch(/hydrogencarbonate/)
      expect(c.change[1]).toBeLessThanOrEqual(10)
    }
  })

  for (const id of ['q5', 'q7']) {
    it(`${id}: final minus starting, ${id === 'q5' ? 'a rise, from a warming reaction' : 'a fall with its sign, from a cooling reaction'}`, () => {
      const built = build('reaction-temperature-change', id)
      for (const b of built) {
        const p = b.question.prompt
        const [s, e] = [...p.matchAll(/(\d+\.\d) °C/g)].map((m) => m[1]!)
        const c = cup(b)
        expect(p.startsWith(c.text)).toBe(true)
        expect(c.warms).toBe(id === 'q5')
        expect(Number(s) >= 16 && Number(s) <= 24).toBe(true)
        expect(answer(b)).toBe(clean(Number(e) - Number(s)))
        expect(id === 'q5' ? answer(b) > 0 : answer(b) < 0).toBe(true)
        expect(Math.abs(answer(b)) >= c.change[0] - 1e-9 && Math.abs(answer(b)) <= c.change[1] + 1e-9).toBe(true)
        if (id === 'q7') expect(p).toContain('final minus starting temperature, with its sign')
        expect(b.question.solution).toContain(`Change = final − starting = $${e} - ${s} = ${fixed(answer(b), 1)}$ °C.`)
        expect(b.question.solution).toContain(id === 'q5' ? '**exothermic**' : '**endothermic**')
        expect(method(b)).toEqual(['final minus starting'])
        expect(last(b)).toBe(`${id === 'q7' ? '−' : ''}${fixed(Math.abs(answer(b)), 1)} °C`)
        expect(tolerance(b)).toBe(toPlaces(answer(b), 1))
        // The size of the change is no reading, nor one with the point moved, doubled or halved.
        expect(clearOf(Math.abs(answer(b)), Number(s), Number(e))).toBe(true)
        // Starting minus final, the wrong way round, is marked wrong.
        expect(mark(b.question, String(-answer(b))).correct).toBe(false)
      }
      expect(contexts(built)).toBe(4)
      spread('reaction-temperature-change', id, ['start', 'end'])
    })
  }

  it('q11: the mean of the three repeats that agree, the anomaly left out', () => {
    const built = build('reaction-mean-temperature-change', 'q11')
    for (const b of built) {
      const p = b.question.prompt
      const c = ENERGY.REPEATED.find((x) => x.name === b.values.context)!
      expect(p).toContain(c.repeat)
      expect(p).toContain(c.warms ? 'rise' : 'fall')
      const texts = /(?:are|of) ((?:\d+\.\d, )+\d+\.\d and \d+\.\d) °C/.exec(p)![1]!.split(/, | and /)
      const xs = texts.map(Number)
      expect(xs).toHaveLength(4)
      // The anomaly is the reading furthest from the other three's mean.
      const away = xs.map((x, i) => Math.abs(x - xs.filter((_, j) => j !== i).reduce((s, y) => s + y, 0) / 3))
      const k = away.indexOf(Math.max(...away))
      const anomaly = xs[k]!
      const kept = xs.filter((_, j) => j !== k)
      const mean = clean(kept.reduce((s, x) => s + x, 0) / 3)
      expect(answer(b)).toBe(mean)
      expect(anomaly).toBe(b.values.anomaly)
      expect(Number.isInteger(Math.round(mean * 10)) && Math.abs(mean * 10 - Math.round(mean * 10)) < 1e-9).toBe(true)
      expect(answer(b) >= c.mean[0] - 1e-9 && answer(b) <= c.mean[1] + 1e-9).toBe(true)
      for (const x of kept) {
        expect(Math.abs(x - mean)).toBeLessThan(0.45)
        expect(x).not.toBe(mean)
      }
      expect(new Set(xs).size).toBe(4)
      expect(Math.abs(anomaly - mean)).toBeGreaterThanOrEqual(Math.max(1.5, mean / 4) - 1e-9)
      expect(anomaly >= mean / 4 - 0.1 && anomaly <= mean * 1.6 + 1e-9 && anomaly <= c.change[1] + 1e-9).toBe(true)
      // Taking all four, or the middle repeat, is marked wrong.
      expect(mark(b.question, String(clean(xs.reduce((s, x) => s + x, 0) / 4))).correct).toBe(false)
      expect(mark(b.question, String([...kept].sort((x, y) => x - y)[1])).correct).toBe(false)
      const keptTexts = texts.filter((_, j) => j !== k)
      expect(b.question.solution).toContain(`${texts[k]} °C is anomalous`)
      expect(b.question.solution).toContain(`\\dfrac{${keptTexts.join(' + ')}}{3} = \\dfrac{${fixed(mean * 3, 1)}}{3} = ${fixed(mean, 1)}$ °C`)
      expect(method(b)).toEqual(['excludes the anomaly'])
      expect(last(b)).toBe(`${fixed(mean, 1)} °C`)
      expect(tolerance(b)).toBe(toPlaces(mean, 1))
    }
    expect(contexts(built)).toBe(4)
    spread('reaction-mean-temperature-change', 'q11', ['anomaly', 'low'])
    // "Drop the lowest reading" pays only when the anomaly is low: about half the time, in every context.
    const many = build('reaction-mean-temperature-change', 'q11', 2000)
    for (const name of ENERGY.REPEATED.map((c) => c.name)) {
      const group = many.filter((b) => b.values.context === name)
      const lowest = group.filter((b) => {
        const xs = [...b.question.prompt.matchAll(/(\d+\.\d)(?=,| and| °C)/g)].map((m) => Number(m[1]))
        return Math.min(...xs) === b.values.anomaly
      }).length
      expect(lowest / group.length, name).toBeGreaterThan(0.4)
      expect(lowest / group.length, name).toBeLessThan(0.6)
    }
    // The anomaly turns up in every position.
    const at = new Set(built.map((b) => [...b.question.prompt.matchAll(/\d+\.\d/g)].findIndex((m) => Number(m[0]) === b.values.anomaly)))
    expect(at).toEqual(new Set([0, 1, 2, 3]))
  })
})

describe('bond energies: broken minus formed', () => {
  const read = (p: string) => ({
    broken: Number(/(?:breaks bonds totalling|to break the bonds in the reactants is|takes in|[Bb]onds broken total) ([\d ]+) kJ\/mol/.exec(p)![1]!.replace(/ /g, '')),
    formed: Number(/(?:forms bonds totalling|when the bonds in the products form is|releases|[Bb]onds formed total) ([\d ]+) kJ\/mol/.exec(p)![1]!.replace(/ /g, '')),
  })
  const signed = (x: number) => (x < 0 ? `−${-x}` : `+${x}`)

  it('q7: two unnamed totals, broken minus formed, exothermic and endothermic in turn', () => {
    const built = build('bond-energy-totals', 'q7')
    for (const b of built) {
      const { broken, formed } = read(b.question.prompt)
      expect(broken).toBe(b.values.broken)
      expect(formed).toBe(b.values.formed)
      for (const x of [broken, formed]) expect(x >= 600 && x <= 3600).toBe(true)
      expect(answer(b)).toBe(broken - formed)
      expect(Math.abs(answer(b)) >= 20 && Math.abs(answer(b)) <= 900).toBe(true)
      expect(clearOf(Math.abs(answer(b)), broken, formed)).toBe(true)
      expect(b.values.context).toBe(answer(b) < 0 ? 'exothermic' : 'endothermic')
      expect(b.question.solution).toContain(`$${broken} - ${formed} = ${answer(b) > 0 ? '+' : ''}${answer(b)}$ kJ/mol`)
      expect(b.question.solution).toContain(answer(b) < 0 ? '**exothermic**' : '**endothermic**')
      expect(method(b)).toEqual(['broken minus formed'])
      expect(last(b)).toBe(`${signed(answer(b))} kJ/mol`)
      expect(tolerance(b)).toBe(0)
      // Formed minus broken gives the wrong sign, and is marked wrong.
      expect(mark(b.question, String(formed - broken)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(2)
    const signs = built.filter((b) => answer(b) < 0).length / built.length
    expect(signs > 0.4 && signs < 0.6).toBe(true)
    spread('bond-energy-totals', 'q7', ['broken', 'formed'])
  })

  it('every molecule has the bonds its structure gives: each atom its valence, one bond fewer than atoms', () => {
    const valence: Record<string, number> = { C: 4, H: 1, O: 2, N: 3, Cl: 1, Br: 1, I: 1 }
    const order = (b: string) => (b.includes('≡') ? 3 : b.includes('=') ? 2 : 1)
    for (const [f, bonds] of Object.entries(BONDS)) {
      const ends: Record<string, number> = {}
      for (const [b, k] of Object.entries(bonds)) for (const el of b.split(/[–=≡]/)) ends[el] = (ends[el] ?? 0) + order(b) * k
      const a = atoms(f)
      // Carbon monoxide's triple bond (one of its pairs dative) gives both atoms three: the one exception.
      for (const el of Object.keys({ ...a, ...ends })) expect(ends[el], `${f} ${el}`).toBe((a[el] ?? 0) * (f === 'CO' ? 3 : valence[el]!))
      const n = Object.values(a).reduce((s, x) => s + x, 0)
      expect(Object.values(bonds).reduce((s, x) => s + x, 0), f).toBe(n - 1)
      for (const b of Object.keys(bonds)) expect(BOND_ENERGY[b], b).toBeDefined()
    }
  })

  it('every reaction balances, and has the sign of the list it is in', () => {
    for (const x of ENERGY.EXOTHERMIC) {
      expect(balanced(x.eq), x.eq.text).toBe(true)
      expect(total(bondsOf(x.eq.left)) - total(bondsOf(x.eq.right)), x.eq.text).toBeLessThan(0)
    }
    for (const x of ENERGY.ENDOTHERMIC) {
      expect(balanced(x.eq), x.eq.text).toBe(true)
      expect(total(bondsOf(x.eq.left)) - total(bondsOf(x.eq.right)), x.eq.text).toBeGreaterThan(0)
    }
    // The written slot's own figures come out of the table.
    const water = ENERGY.EXOTHERMIC.find((x) => x.eq.text === '2H2 + O2 -> 2H2O')!
    expect([total(bondsOf(water.eq.left)), total(bondsOf(water.eq.right))]).toEqual([1370, 1856])
  })

  it('q11: a named equation, its totals summed bond by bond, broken minus formed', () => {
    const built = build('bond-energy-equation', 'q11', 600)
    const all = [...ENERGY.EXOTHERMIC, ...ENERGY.ENDOTHERMIC]
    for (const b of built) {
      const p = b.question.prompt
      const x = all.find((y) => y.eq.text === b.values.reaction)!
      expect(p).toContain(printed(x))
      // The equation printed is the one whose atoms balance.
      const sides = printed(x).split(/ [→⇌] /)
      expect(sides).toHaveLength(2)
      expect(count(x.eq.left)).toEqual(count(x.eq.right))
      const { broken, formed } = read(p)
      expect(broken).toBe(total(bondsOf(x.eq.left)))
      expect(formed).toBe(total(bondsOf(x.eq.right)))
      expect(answer(b)).toBe(broken - formed)
      // Each side's working lists its bonds, counted from the molecules, and prices them.
      for (const [label, side, sum] of [['broken', x.eq.left, broken], ['formed', x.eq.right, formed]] as const) {
        const bonds = bondsOf(side)
        const line = new RegExp(`Bonds ${label}: ([^.]+)\\.`).exec(b.question.solution)![1]!
        // Every bond named once, with its count, and the list joined as prose: no stray "and".
        expect(line, b.seed).not.toMatch(/^(and|,)|  |\b1 [A-Z]/)
        for (const [y, k] of bonds) expect(line).toContain(`${k === 1 ? 'one' : k} ${y}`)
        if (bonds.length === 1 && bonds[0]![1] === 1) expect(line).toBe(`one ${bonds[0]![0]}, ${tex(sum)} kJ/mol`)
        else {
          const terms = /\$(.+) = ([\d\\,]+)\$/.exec(line)!
          expect(terms[2]).toBe(tex(sum))
          const priced = terms[1]!.split(' + ').map((t) => t.split(' \\times ').map(Number).reduce((s, y) => s * y, 1))
          expect(priced.reduce((s, y) => s + y, 0)).toBe(sum)
          expect(priced).toEqual(bonds.map(([y, k]) => k * BOND_ENERGY[y]!))
        }
      }
      expect(b.question.solution).toContain(`$${tex(broken)} - ${tex(formed)} = ${answer(b) > 0 ? '+' : ''}${answer(b)}$ kJ/mol`)
      expect(b.question.solution).not.toMatch(/\b1 \\times/)
      expect(b.values.context).toBe(ENERGY.EXOTHERMIC.includes(x) ? 'exothermic' : 'endothermic')
      expect(last(b)).toBe(`${signed(answer(b))} kJ/mol`)
      expect(method(b)).toEqual(['broken minus formed'])
      expect(tolerance(b)).toBe(0)
      if (x.reversible) expect(p).toContain('⇌')
      else expect(p).not.toContain('⇌')
      expect(mark(b.question, String(formed - broken)).correct).toBe(false)
    }
    const many = build('bond-energy-equation', 'q11', 1000)
    expect(new Set(many.map((b) => b.values.reaction)).size).toBe(all.length)
    const signs = many.filter((b) => answer(b) < 0).length / many.length
    expect(signs > 0.4 && signs < 0.6).toBe(true)
    // Each context: no answer over a fifth of builds, and ten answers or more.
    const { worst, fewest } = worstShare(many, answer)
    expect(worst).toBeLessThanOrEqual(0.2)
    expect(fewest).toBeGreaterThanOrEqual(10)
  })

  it('q11: prints a side of one kind of bond, and of two, as plain prose', () => {
    const lines: Record<string, string[]> = {
      '2H2 + O2 -> 2H2O': ['Bonds broken: 2 H–H and one O=O: $2 \\times 436 + 498 = 1370$ kJ/mol.', 'Bonds formed: 4 O–H: $4 \\times 464 = 1856$ kJ/mol.'],
      'N2 + 3H2 -> 2NH3': ['Bonds broken: one N≡N and 3 H–H: $945 + 3 \\times 436 = 2253$ kJ/mol.', 'Bonds formed: 6 N–H: $6 \\times 391 = 2346$ kJ/mol.'],
      '2HI -> H2 + I2': ['Bonds broken: 2 H–I: $2 \\times 298 = 596$ kJ/mol.', 'Bonds formed: one H–H and one I–I: $436 + 151 = 587$ kJ/mol.'],
      'C2H6 -> C2H4 + H2': ['Bonds broken: one C–C and 6 C–H: $348 + 6 \\times 412 = 2820$ kJ/mol.', 'Bonds formed: one C=C, 4 C–H and one H–H: $614 + 4 \\times 412 + 436 = 2698$ kJ/mol.'],
    }
    const many = build('bond-energy-equation', 'q11', 1000)
    for (const [eq, want] of Object.entries(lines)) {
      const b = many.find((x) => x.values.reaction === eq)!
      expect(b, eq).toBeDefined()
      for (const w of want) expect(b.question.solution).toContain(w)
    }
  })

  it('q11: enough reactions for 150 prompts or more, each total under 16 000 kJ/mol', () => {
    const all = [...ENERGY.EXOTHERMIC, ...ENERGY.ENDOTHERMIC]
    expect(all.length * ENERGY.EQUATION_PROMPTS.length).toBeGreaterThanOrEqual(150)
    expect(new Set(build('bond-energy-equation', 'q11', 1000).map((b) => b.question.prompt)).size).toBeGreaterThanOrEqual(140)
    for (const x of all) for (const side of [x.eq.left, x.eq.right]) expect(total(bondsOf(side)), x.eq.text).toBeLessThan(16000)
    expect(all.map((x) => x.eq.text)).not.toContain('2C4H10 + 13O2 -> 8CO2 + 10H2O')
    // The endothermic list gives ten answers or more, the crackings one entry between them.
    expect(new Set(ENERGY.ENDOTHERMIC.map((x) => total(bondsOf(x.eq.left)) - total(bondsOf(x.eq.right)))).size).toBeGreaterThanOrEqual(10)
    for (const group of [...ENERGY.EXO_GROUPS, ...ENERGY.ENDO_GROUPS]) expect(new Set(group.map((x) => total(bondsOf(x.eq.left)) - total(bondsOf(x.eq.right)))).size).toBe(1)
  })

  it('a reaction and its reverse print the same arrow', () => {
    const key = (l: string, r: string) => `${l}|${r}`
    const sides = (x: (typeof ENERGY.EXOTHERMIC)[number]) => x.eq.text.split(' -> ')
    const all = [...ENERGY.EXOTHERMIC, ...ENERGY.ENDOTHERMIC]
    const byText = new Map(all.map((x) => [key(sides(x)[0]!, sides(x)[1]!), x]))
    let pairs = 0
    for (const x of all) {
      const back = byText.get(key(sides(x)[1]!, sides(x)[0]!))
      if (!back) continue
      pairs++
      expect(Boolean(back.reversible), x.eq.text).toBe(Boolean(x.reversible))
    }
    // Ethene and steam, the Haber process, water-gas, methanol, hydrogen bromide, water: each both ways.
    expect(pairs).toBeGreaterThanOrEqual(10)
  })
})
